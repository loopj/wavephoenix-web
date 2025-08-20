import { withTimeout } from "../utils.js";

export const MANAGEMENT_SERVICE_UUID = BluetoothUUID.canonicalUUID(0x5750);

const SETTINGS_CHAR_UUID = BluetoothUUID.canonicalUUID(0x5751);
const COMMANDS_CHAR_UUID = BluetoothUUID.canonicalUUID(0x5752);
const FIRMWARE_DATA_CHAR_UUID = BluetoothUUID.canonicalUUID(0x5753);
const VERSION_UUID = BluetoothUUID.canonicalUUID(0x5754);

const COMMANDS = {
  REBOOT: 0x00,
  ENTER_SETTINGS: 0x01,
  LEAVE_SETTINGS: 0x02,
  BEGIN_PAIRING: 0x03,
  END_PAIRING: 0x04,
  BEGIN_DFU: 0x05,
  APPLY_DFU: 0x06,
};

const SETTINGS = {
  WIRELESS_CHANNEL: 0x00,
  CONTROLLER_TYPE: 0x01,
  PIN_WIRELESS_ID: 0x02,
  PAIRING_BUTTONS: 0x03,
};

export class ManagementClient {
  #device = null;

  #disconnectCallback = null;

  #settingsChar = null;
  #commandsChar = null;
  #firmwareDataChar = null;
  #versionChar = null;

  #version = null;

  constructor(device) {
    this.#device = device;
    this.#device.addEventListener("gattserverdisconnected", this.gattServerDisconnected);
  }

  async connect({ timeout = 15000 } = {}) {
    // Connect to the GATT server
    await withTimeout(this.#device.gatt.connect(), timeout);

    // Set up characteristics
    const service = await this.#device.gatt.getPrimaryService(MANAGEMENT_SERVICE_UUID);
    this.#settingsChar = await service.getCharacteristic(SETTINGS_CHAR_UUID);
    this.#commandsChar = await service.getCharacteristic(COMMANDS_CHAR_UUID);
    this.#firmwareDataChar = await service.getCharacteristic(FIRMWARE_DATA_CHAR_UUID);
    this.#versionChar = await service.getCharacteristic(VERSION_UUID);

    // Pre-fetch current firmware version
    await this.fetchVersion();
  }

  async disconnect() {
    this.#device.gatt.disconnect();
  }

  get connected() {
    return this.#device.gatt.connected ?? false;
  }

  gattServerDisconnected = (event) => {
    this.#disconnectCallback?.();
  };

  setDisconnectCallback(callback) {
    const prevCallback = this.#disconnectCallback;
    this.#disconnectCallback = callback;
    return prevCallback;
  }

  //
  // Commands
  //

  async sendCommand(commandCode) {
    await this.#commandsChar.writeValue(Uint8Array.of(commandCode));
  }

  async beginDFU() {
    await this.sendCommand(COMMANDS.BEGIN_DFU);
  }

  async applyDFU() {
    await this.sendCommand(COMMANDS.APPLY_DFU);
  }

  async leaveSettings() {
    await this.sendCommand(COMMANDS.LEAVE_SETTINGS);
  }

  //
  // Settings
  //

  async readSetting(settingCode) {
    await this.#settingsChar.writeValue(Uint8Array.of(settingCode));
    const value = await this.#settingsChar.readValue();
    return value;
  }

  async writeSetting(settingCode, data) {
    const buf = new Uint8Array([settingCode, ...data]);
    await this.#settingsChar.writeValue(buf);
  }

  async getWirelessChannel() {
    const wirelessChannelBytes = await this.readSetting(SETTINGS.WIRELESS_CHANNEL);
    return wirelessChannelBytes.getUint8(0);
  }

  async setWirelessChannel(channel) {
    await this.writeSetting(SETTINGS.WIRELESS_CHANNEL, [channel]);
  }

  async getControllerType() {
    const controllerTypeBytes = await this.readSetting(SETTINGS.CONTROLLER_TYPE);
    return controllerTypeBytes.getUint8(0);
  }

  async setControllerType(type) {
    await this.writeSetting(SETTINGS.CONTROLLER_TYPE, [type]);
  }

  async getPinWirelessId() {
    const pinWirelessIdBytes = await this.readSetting(SETTINGS.PIN_WIRELESS_ID);
    return pinWirelessIdBytes.getUint8(0) === 1;
  }

  async setPinWirelessId(enabled) {
    await this.writeSetting(SETTINGS.PIN_WIRELESS_ID, [enabled ? 1 : 0]);
  }

  async getPairingButtons() {
    const pairingButtonsBytes = await this.readSetting(SETTINGS.PAIRING_BUTTONS);
    return pairingButtonsBytes.getUint16(0, true);
  }

  async setPairingButtons(buttons) {
    await this.writeSetting(SETTINGS.PAIRING_BUTTONS, [buttons & 0xff, (buttons >> 8) & 0xff]);
  }

  //
  // Firmware
  //

  async writeFirmware(data, { withResponse = false, wait = 10 } = {}) {
    if (withResponse) {
      await this.#firmwareDataChar.writeValueWithResponse(data);
    } else {
      await this.#firmwareDataChar.writeValueWithoutResponse(data);
      await new Promise((r) => setTimeout(r, wait));
    }
  }

  //
  // Version
  //

  async fetchVersion() {
    const version = await this.#versionChar.readValue();
    this.#version = {
      major: version.getUint8(3),
      minor: version.getUint8(2),
      patch: version.getUint8(1),
      build: version.getUint8(0),
    };
  }

  getVersion() {
    return this.#version;
  }
}
