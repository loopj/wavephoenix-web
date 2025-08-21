import { GeckoBootloaderClient, OTA_SERVICE_UUID } from "@/clients/GeckoBootloaderClient.js";
import { MANAGEMENT_SERVICE_UUID, ManagementClient } from "@/clients/ManagementClient.js";
import { MIGRATION_SERVICE_UUID, MigrationClient } from "@/clients/MigrationClient.js";

import { withTimeout } from "@/utils.js";

export async function connectToDevice() {
  // Map UUIDs to device modes
  const UUID_TO_DEVICE_MODE = {
    [BluetoothUUID.canonicalUUID(MANAGEMENT_SERVICE_UUID)]: "management",
    [BluetoothUUID.canonicalUUID(MIGRATION_SERVICE_UUID)]: "migration",
    [OTA_SERVICE_UUID]: "legacy",
  };

  // Prompt the user to select a Bluetooth device
  const device = await navigator.bluetooth.requestDevice({
    filters: [{ namePrefix: "WavePhoenix" }],
    optionalServices: Object.keys(UUID_TO_DEVICE_MODE),
  });

  // Attempt to connect so we can discover services
  await withTimeout(device.gatt.connect(), 10000);

  // Get the UUID of the first service on the device
  const serviceUUID = (await device.gatt.getPrimaryServices()).map((s) => s.uuid)[0];

  // Create the appropriate client based on the mode
  let client;
  const mode = UUID_TO_DEVICE_MODE[serviceUUID];
  if (mode === "management") {
    client = new ManagementClient(device);
    await client.connect();
  } else if (mode === "migration") {
    client = new MigrationClient(device);
    await client.connect();
  } else if (mode === "legacy") {
    client = new GeckoBootloaderClient(device);
    await client.connect();
  } else {
    device.gatt.disconnect();
    throw new Error(`Unknown service UUID: ${serviceUUID}`);
  }

  return { client, mode };
}
