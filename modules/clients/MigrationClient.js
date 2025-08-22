import { withTimeout } from "@/utils.js";

export const MIGRATION_SERVICE_UUID = 0x5760;

export class MigrationClient {
  #device = null;

  constructor(device) {
    this.#device = device;
  }

  async connect({ timeout = 15000 } = {}) {
    // Connect to the GATT server
    await withTimeout(this.#device.gatt.connect(), timeout);

    // Set up characteristics
    const service = await this.#device.gatt.getPrimaryService(MIGRATION_SERVICE_UUID);
  }

  disconnect() {
    this.#device.gatt.disconnect();
  }

  get connected() {
    return this.#device.gatt.connected ?? false;
  }

  addDisconnectHandler(handler) {
    this.#device.addEventListener("gattserverdisconnected", handler);
  }

  removeDisconnectHandler(handler) {
    this.#device.removeEventListener("gattserverdisconnected", handler);
  }
}
