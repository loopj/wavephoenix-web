const MANAGEMENT_SERVICE_UUID = 0x5750;
const SETTINGS_CHAR_UUID = 0x5751;
const COMMANDS_CHAR_UUID = 0x5752;
const FIRMWARE_DATA_CHAR_UUID = 0x5753;
const VERSION_UUID = 0x5754;

export const COMMANDS = {
  REBOOT: 0x00,
  ENTER_SETTINGS: 0x01,
  LEAVE_SETTINGS: 0x02,
  BEGIN_PAIRING: 0x03,
  END_PAIRING: 0x04,
  BEGIN_DFU: 0x05,
  APPLY_DFU: 0x06,
};

export const SETTINGS = {
  WIRELESS_CHANNEL: 0x00,
  CONTROLLER_TYPE: 0x01,
  PIN_WIRELESS_ID: 0x02,
  PAIRING_BUTTONS: 0x03,
};

export class TimeoutError extends Error {}
export class UserCancelledError extends Error {}

export function versionString(version) {
  let versionString = `${version.major}.${version.minor}.${version.patch}`;
  if (version.tweak !== 0) {
    versionString += ` (${version.tweak})`;
  }
  return versionString;
}

export class MCUbootImage {
  static MAGIC = 0x96f3b83d;

  constructor(arrayBuffer) {
    this.data = new Uint8Array(arrayBuffer);
    this.dataView = new DataView(arrayBuffer);
  }

  getMagicNumber() {
    return this.dataView.getUint32(0, true);
  }

  checkMagicNumber() {
    return this.getMagicNumber() === MCUbootImage.MAGIC;
  }

  getVersion() {
    // Version fields at offsets 20, 21, 22, 24 (see mcuboot.js)
    return {
      major: this.dataView.getUint8(20),
      minor: this.dataView.getUint8(21),
      patch: this.dataView.getUint16(22, true),
      tweak: this.dataView.getUint32(24, true),
    };
  }

  getSize() {
    return this.data.length;
  }

  async calculateSHA256() {
    return await crypto.subtle.digest("SHA-256", this.data);
  }
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export class Client {
  #device = null;

  #disconnectCallback = null;

  #settingsChar = null;
  #commandsChar = null;
  #firmwareDataChar = null;
  #versionChar = null;

  #version = null;

  async connect(timeout = 5000) {
    // Prompt user to select a Bluetooth device
    if (!this.#device) {
      this.#device = await navigator.bluetooth.requestDevice({
        filters: [{ name: "WavePhoenix" }],
        optionalServices: [MANAGEMENT_SERVICE_UUID],
      });

      this.#device.addEventListener("gattserverdisconnected", this.gattServerDisconnected);
    }

    // Connect to the gatt server
    const server = await Promise.race([
      this.#device.gatt.connect(),
      new Promise((_, reject) => setTimeout(() => reject(new TimeoutError()), timeout)),
    ]);

    console.log(`Bluetooth device '${this.#device.name}' connected, id=${this.#device.id}`);

    // Set up characteristics
    const service = await server.getPrimaryService(MANAGEMENT_SERVICE_UUID);
    this.#settingsChar = await service.getCharacteristic(SETTINGS_CHAR_UUID);
    this.#commandsChar = await service.getCharacteristic(COMMANDS_CHAR_UUID);
    this.#firmwareDataChar = await service.getCharacteristic(FIRMWARE_DATA_CHAR_UUID);
    this.#versionChar = await service.getCharacteristic(VERSION_UUID);

    // Pre-fetch current firmware version
    await this.fetchVersion();
  }

  async disconnect() {
    if (this.#device) {
      this.#device.gatt.disconnect();
    }
  }

  clearDevice() {
    this.#device = null;
  }

  get connected() {
    return this.#device?.gatt.connected ?? false;
  }

  gattServerDisconnected = (event) => {
    console.log("Bluetooth device disconnected");
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
      await delay(wait);
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
      tweak: version.getUint8(0),
    };
  }

  getVersion() {
    return this.#version;
  }
}
