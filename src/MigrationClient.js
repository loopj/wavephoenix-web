import { withTimeout } from '@/utils.js';

export const MIGRATION_SERVICE_UUID = '4ac83b7e-bd70-4174-9744-4c28345fe336';

// Characteristic UUIDs
const COMMAND_CHAR_UUID = 'ce5e7d1d-1eab-471d-8c8a-b2ac5f1483ca';
const DATA_CHAR_UUID = '6eb41c56-281b-487b-a993-b257922796de';

export class MigrationClient {
  #device = null;

  #commandChar = null;
  #dataChar = null;

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
}
