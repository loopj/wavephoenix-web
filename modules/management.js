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

export function versionString(version) {
  let versionString = `${version.major}.${version.minor}.${version.patch}`;
  if (version.tweak !== 0) {
    versionString += ` (${version.tweak})`;
  }
  return versionString;
}

export class FirmwareImage {
  // MCUboot header
  static MAGIC = 0x96f3b83d;
  static HEADER_SIZE = 32;

  constructor(arrayBuffer) {
    this.data = new Uint8Array(arrayBuffer);
    this.dataView = new DataView(arrayBuffer);
  }

  checkMagicNumber() {
    // Magic number is first 4 bytes, little-endian
    return this.dataView.getUint32(0, true) === FirmwareImage.MAGIC;
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

  async getSHA256() {
    return await crypto.subtle.digest("SHA-256", this.data);
  }
}

export class Management {
  #dfuActive = false;
  #dfuCancelled = false;
  #device = null;
  #settingsChar = null;
  #commandsChar = null;
  #firmwareDataChar = null;
  #versionChar = null;
  #version = null;
  #disconnectCallback = null;

  async connect() {
    this.#device = await navigator.bluetooth.requestDevice({
      filters: [{ name: "WavePhoenix" }],
      optionalServices: [MANAGEMENT_SERVICE_UUID],
    });

    // Connect to the gatt server
    const server = await this.#device.gatt.connect();

    // Set up characteristics
    const service = await server.getPrimaryService(MANAGEMENT_SERVICE_UUID);
    this.#settingsChar = await service.getCharacteristic(SETTINGS_CHAR_UUID);
    this.#commandsChar = await service.getCharacteristic(COMMANDS_CHAR_UUID);
    this.#firmwareDataChar = await service.getCharacteristic(FIRMWARE_DATA_CHAR_UUID);
    this.#versionChar = await service.getCharacteristic(VERSION_UUID);

    // Pre-fetch version
    this.#version = await this.readVersion();

    this.#device.addEventListener("gattserverdisconnected", this.#disconnectCallback);
  }

  onDisconnect(callback) {
    this.#disconnectCallback = callback;
  }

  async sendCommand(commandCode) {
    await this.#commandsChar.writeValue(Uint8Array.of(commandCode));
  }

  async readSetting(settingCode) {
    await this.#settingsChar.writeValue(Uint8Array.of(settingCode));
    const value = await this.#settingsChar.readValue();
    return value;
  }

  async writeSetting(settingCode, data) {
    const buf = new Uint8Array([settingCode, ...data]);
    await this.#settingsChar.writeValue(buf);
  }

  async writeFirmwareData(data, withResponse = false) {
    if (withResponse) {
      await this.#firmwareDataChar.writeValueWithResponse(data);
    } else {
      await this.#firmwareDataChar.writeValueWithoutResponse(data);
    }
  }

  async readVersion() {
    const version = await this.#versionChar.readValue();

    return {
      major: version.getUint8(3),
      minor: version.getUint8(2),
      patch: version.getUint8(1),
      tweak: version.getUint8(0),
    };
  }

  getVersion() {
    return this.#version;
  }

  async startDFU(firmwareImage, onProgress) {
    const CHUNK_SIZE = 64;
    this.#dfuCancelled = false;
    this.#dfuActive = true;

    let offset = 0;
    if (onProgress) onProgress(0);

    // Step 1: Send DFU_BEGIN command
    await this.sendCommand(COMMANDS.BEGIN_DFU);
    await this._delay(100);

    // Step 2: Send firmware data in chunks
    while (offset < firmwareImage.data.length) {
      // Handle cancellation
      if (this.#dfuCancelled) throw new Error("DFU cancelled by user");

      // Get the next chunk
      const chunkEnd = Math.min(offset + CHUNK_SIZE, firmwareImage.data.length);
      const chunk = firmwareImage.data.slice(offset, chunkEnd);

      // Send the chunk
      await this.writeFirmwareData(chunk, false);
      await this._delay(10);
      offset = chunkEnd;

      // Update progress
      if (onProgress) onProgress(Math.round((offset / firmwareImage.data.length) * 100));
    }

    // Step 3: Send DFU_APPLY command
    await this._delay(500);
    await this.sendCommand(COMMANDS.APPLY_DFU);
    await this._delay(500);

    // Make sure progress bars get to 100%
    if (onProgress) onProgress(100);
    this.#dfuActive = false;
  }

  cancelDFU() {
    if (!this.#dfuActive) return;

    this.#dfuCancelled = true;
    this.#dfuActive = false;

    console.log("DFU cancelled by user");
  }

  _delay(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }
}
