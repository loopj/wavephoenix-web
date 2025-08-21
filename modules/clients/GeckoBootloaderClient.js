/**
 * Gecko Bootloader Client
 *
 * Implements Gecko Bootloader Bluetooth OTA upgrade protocol.
 *
 * Protocol documentation:
 * https://docs.silabs.com/bluetooth/latest/using-gecko-bootloader-with-bluetooth-apps/03-bluetooth-ota-upgrade
 */

import { withTimeout } from "@/utils.js";

// Service UUID
const OTA_SERVICE_UUID = "1d14d6ee-fd63-4fa1-bfa4-8f47b42119f0";

// Characteristic UUIDs
const OTA_CONTROL_UUID = "f7bf3564-fb6d-4e53-88a4-5e37e0326063";
const OTA_DATA_UUID = "984227f3-34fc-4045-a5d0-2c581f81a153";
const APPLOADER_VERSION_UUID = "4f4a2368-8cca-451e-bfff-cf0e2ee23e9f";
const OTA_VERSION_UUID = "4cc07bcf-0868-4b32-9dad-ba4cc41e5316";
const GECKO_BOOTLOADER_VERSION_UUID = "25f05c0a-e917-46e9-b2a5-aa2be1245afe";
const APPLICATION_VERSION_UUID = "0d77cc11-4ac1-49f2-bfa9-cd96ac7a92f8";

// Commands for the OTA control characteristic
const COMMANDS = {
  START_OTA: 0x00,
  FINISH_OTA: 0x03,
  CLOSE_CONNECTION: 0x04,
};

export class GeckoBootloaderClient {
  #device;

  #otaControlChar;
  #otaDataChar;
  #applicationVersionChar;

  static get SERVICE_UUID() {
    return OTA_SERVICE_UUID;
  }

  constructor(device) {
    this.#device = device;
  }

  async connect({ timeout = 15000 } = {}) {
    // Connect to the GATT server
    await withTimeout(this.#device.gatt.connect(), timeout);

    // Set up characteristics
    const service = await this.#device.gatt.getPrimaryService(OTA_SERVICE_UUID);
    this.#otaControlChar = await service.getCharacteristic(OTA_CONTROL_UUID);
    this.#otaDataChar = await service.getCharacteristic(OTA_DATA_UUID);
    this.#applicationVersionChar = await service.getCharacteristic(APPLICATION_VERSION_UUID);
  }

  disconnect() {
    if (!this.#device.gatt.connected) return;
    this.#device.gatt.disconnect();
  }

  async #otaControl(command) {
    await this.#otaControlChar.writeValueWithResponse(Uint8Array.of(command));
  }

  async writeFirmware(data, { reliable = false, wait = 10, chunkSize = 64, progress, signal } = {}) {
    // Handle abort signal
    signal?.throwIfAborted();

    // Start the OTA process
    await this.#otaControl(COMMANDS.START_OTA);

    // Write the firmware in chunks
    const total = data.byteLength;
    for (let start = 0; start < total; start += chunkSize) {
      // Handle abort signal
      signal?.throwIfAborted();

      // Grab the next chunk
      const chunk = data.slice(start, start + chunkSize);

      // Write the chunk
      if (reliable) {
        await this.#otaDataChar.writeValueWithResponse(chunk);
      } else {
        await this.#otaDataChar.writeValueWithoutResponse(chunk);
        await new Promise((r) => setTimeout(r, wait));
      }

      // Update progress
      progress?.((start / total) * 100);
    }

    // Handle abort signal
    signal?.throwIfAborted();

    // Finish the OTA process
    await this.#otaControl(COMMANDS.FINISH_OTA);
  }

  async getVersion() {
    const version = await this.#applicationVersionChar.readValue();
    return {
      major: version.getUint8(3),
      minor: version.getUint8(2),
      patch: version.getUint8(1),
      build: version.getUint8(0),
    };
  }
}
