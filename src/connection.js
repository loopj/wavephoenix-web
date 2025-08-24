import { GBL_OTA_SERVICE_UUID, GeckoBootloaderClient } from 'https://esm.sh/gbl-tools';
import { MANAGEMENT_SERVICE_UUID, ManagementClient } from './ManagementClient.js';
import { MIGRATION_SERVICE_UUID, MigrationClient } from './MigrationClient.js';
import { withTimeout } from './utils.js';

export let connection = null;

const UUID_TO_DEVICE_MODE = {
  [MANAGEMENT_SERVICE_UUID]: 'management',
  [MIGRATION_SERVICE_UUID]: 'migration',
  [GBL_OTA_SERVICE_UUID]: 'legacy',
};

export async function connect() {
  // Prompt the user to select a Bluetooth device
  let device;
  try {
    device = await navigator.bluetooth.requestDevice({
      filters: [{ namePrefix: 'WavePhoenix' }],
      optionalServices: Object.keys(UUID_TO_DEVICE_MODE),
    });
  } catch (e) {
    if (e.name === 'NotFoundError') {
      const error = new Error('User cancelled Bluetooth device selection');
      error.code = 'ECANCELED';
      throw error;
    } else {
      throw e;
    }
  }

  // Attempt to connect so we can discover services
  await withTimeout(device.gatt.connect(), 10000);

  // Get the UUID of the first service on the device
  const serviceUUID = (await device.gatt.getPrimaryServices()).map((s) => s.uuid)[0];

  // Create the appropriate client based on the mode
  let client = null;
  const mode = UUID_TO_DEVICE_MODE[serviceUUID];
  switch (mode) {
    case 'management':
      client = new ManagementClient(device);
      await client.connect();
      break;
    case 'migration':
      client = new MigrationClient(device);
      await client.connect();
      break;
    case 'legacy':
      client = new GeckoBootloaderClient(device);
      await client.connect();
      break;
    default:
      device.gatt.disconnect();
      connection = null;
      throw new Error(`Unknown service UUID: ${serviceUUID}`);
  }

  // Save the connection details
  connection = { client, mode };

  return connection;
}
