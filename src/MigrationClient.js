import { withTimeout } from '@/utils.js';

export const MIGRATION_SERVICE_UUID = '4ac83b7e-bd70-4174-9744-4c28345fe336';

// Characteristic UUIDs
const COMMAND_CHAR_UUID = 'ce5e7d1d-1eab-471d-8c8a-b2ac5f1483ca';
const DATA_CHAR_UUID = '6eb41c56-281b-487b-a993-b257922796de';
const DIGEST_CHAR_UUID = '825114d9-7409-4d83-b9d1-acabac8e5186';

// Commands
const COMMAND = {
  REBOOT: 0x00,
  BEGIN_APP_UPLOAD: 0x01,
  APPLY_APP_UPLOAD: 0x02,
  BEGIN_BOOTLOADER_UPLOAD: 0x03,
  APPLY_BOOTLOADER_UPLOAD: 0x04,
};

export class MigrationClient {
  #device = null;

  #commandChar = null;
  #dataChar = null;
  #digestChar = null;

  constructor(device) {
    this.#device = device;
  }

  async connect({ timeout = 15000 } = {}) {
    // Connect to the GATT server
    await withTimeout(this.#device.gatt.connect(), timeout);

    // Set up characteristics
    const service = await this.#device.gatt.getPrimaryService(MIGRATION_SERVICE_UUID);
    this.#commandChar = await service.getCharacteristic(COMMAND_CHAR_UUID);
    this.#dataChar = await service.getCharacteristic(DATA_CHAR_UUID);
    this.#digestChar = await service.getCharacteristic(DIGEST_CHAR_UUID);
  }

  disconnect() {
    this.#device.gatt.disconnect();
  }

  get connected() {
    return this.#device.gatt.connected ?? false;
  }

  addDisconnectHandler(handler) {
    this.#device.addEventListener('gattserverdisconnected', handler);
  }

  removeDisconnectHandler(handler) {
    this.#device.removeEventListener('gattserverdisconnected', handler);
  }

  async #writeCommand(command) {
    await this.#commandChar.writeValueWithResponse(Uint8Array.of(command));
  }

  async #writeData(data, { reliable = false, wait = 10, chunkSize = 64, progress, signal } = {}) {
    // Write the firmware in chunks
    const total = data.byteLength;
    for (let start = 0; start < total; start += chunkSize) {
      // Grab the next chunk
      const chunk = data.slice(start, start + chunkSize);

      // Write the chunk
      signal?.throwIfAborted();
      if (reliable) {
        await this.#dataChar.writeValueWithResponse(chunk);
      } else {
        await this.#dataChar.writeValueWithoutResponse(chunk);
        await new Promise((r) => setTimeout(r, wait));
      }

      // Update progress
      progress?.((start / total) * 100);
    }
  }

  async flashApp(data, { reliable, wait, chunkSize, progress, signal } = {}) {
    // Start the OTA process
    signal?.throwIfAborted();
    await this.#writeCommand(COMMAND.BEGIN_APP_UPLOAD);

    // Send the firmware data
    await this.#writeData(data, { reliable, wait, chunkSize, progress, signal });

    // Finish the OTA process
    signal?.throwIfAborted();
    await this.#writeCommand(COMMAND.APPLY_APP_UPLOAD);
  }

  async flashBootloader(data, { reliable, wait, chunkSize, progress, signal } = {}) {
    // Start the OTA process
    signal?.throwIfAborted();
    await this.#writeCommand(COMMAND.BEGIN_BOOTLOADER_UPLOAD);

    // Send the firmware data
    await this.#writeData(data, { reliable, wait, chunkSize, progress, signal });

    // Finish the OTA process
    signal?.throwIfAborted();
    await this.#writeCommand(COMMAND.APPLY_BOOTLOADER_UPLOAD);
  }

  async getDigest() {
    const value = await this.#digestChar.readValue();
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }

  async reboot() {
    try {
      await this.#writeCommand(COMMAND.REBOOT);
    } catch (e) {
      // Supress GATT errors during reboot, we are expecting a disconnect
      if (e.name !== 'NotSupportedError') {
        throw e;
      }
    }
  }
}
