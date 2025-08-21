import { withTimeout } from "@/utils.js";

const MIGRATION_SERVICE_UUID = 0x5760;

export class MigrationClient {
  #device = null;

  static get SERVICE_UUID() {
    return BluetoothUUID.canonicalUUID(MIGRATION_SERVICE_UUID);
  }

  constructor(device) {
    this.#device = device;
    this.#device.addEventListener("gattserverdisconnected", this.gattServerDisconnected);
  }

  async connect({ timeout = 15000 } = {}) {
    // Connect to the GATT server
    await withTimeout(this.#device.gatt.connect(), timeout);

    // Set up characteristics
    const service = await this.#device.gatt.getPrimaryService(MigrationClient.SERVICE_UUID);
  }

  disconnect() {
    if (!this.connected) return;

    this.#device.gatt.disconnect();
  }

  get connected() {
    return this.#device.gatt.connected ?? false;
  }

  gattServerDisconnected = () => {
    // Handle disconnection logic here
  };
}
