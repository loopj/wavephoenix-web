import { useComputed, useSignal } from '@preact/signals';
import { html } from 'htm/preact';
import { useRef } from 'preact/hooks';

import { MCUbootImage } from '@/MCUbootImage.js';

import { connection, useDisconnectHandler } from '@/connection.js';
import { showPage } from '@/nav.js';
import { typedArraysEqual } from '@/utils.js';

// WavePhoenix app firmware id
const APP_ID_TLV = 0xc001;
const WAVEPHOENIX_APP_MAGIC = new Uint8Array([0x57, 0x50]);

export function MigrationPage() {
  const selectedAppFile = useSignal(null);
  const selectedBtlFile = useSignal(null);
  const uploadProgress = useSignal(0);

  const appFile = useRef(null);
  const btlFile = useRef(null);

  const selectedFilesValid = useComputed(() => {
    return !!selectedAppFile.value?.type && !!selectedBtlFile.value?.type;
  });

  useDisconnectHandler(() => {
    showPage('connect');
  });

  function backButtonClick() {
    connection.client.disconnect();
  }

  async function appFileChange(event) {
    const file = appFile.current.files[0];
    const name = file.name;
    const data = await file.arrayBuffer();
    const image = new MCUbootImage(data);

    if (!(await image.isValid())) {
      return;
    }

    // Check if the image is a WavePhoenix app firmware
    if (!typedArraysEqual(image.getTLV(APP_ID_TLV), WAVEPHOENIX_APP_MAGIC)) {
      return;
    }

    selectedAppFile.value = { name, data, type: 'zephyr' };
  }

  async function btlFileChange(event) {
    const file = btlFile.current.files[0];
    const name = file.name;
    const data = await file.arrayBuffer();

    // TODO: Validate the bootloader vs a whitelist of known good bootloaders

    selectedBtlFile.value = { name, data, type: 'zephyr' };
  }

  async function uploadFirmwareClick() {
    // Step 1: Upload the new zephyr app firmware, and validate
    const appExpectedSHA = new Uint8Array(
      await crypto.subtle.digest('SHA-256', selectedAppFile.value.data)
    );

    // Flash the app
    await connection.client.flashApp(selectedAppFile.value.data, {
      progress: (value) => {
        uploadProgress.value = value / 2;
      },
    });

    // Validate the app's SHA-256
    const appActualSHA = await connection.client.getDigest();
    if (!typedArraysEqual(appExpectedSHA, appActualSHA)) {
      console.error('App upload failed: SHA-256 mismatch');
      // TODO: Just fail and have user initiate upload again
      return;
    }

    // Step 2: Upload the new MCUboot bootloader firmware, and validate
    // ENTER CRITICAL SECTION - DO NOT DISCONNECT UNTIL REBOOTED
    // TODO: Add a beforeunload handler to prevent tab close / reload
    // TODO: Disable cancel/back buttons
    const btlExpectedSHA = new Uint8Array(
      await crypto.subtle.digest('SHA-256', selectedBtlFile.value.data)
    );

    // Try up to 3 times in case of failure
    let success = false;
    for (let i = 0; i < 3; i++) {
      try {
        // Flash the bootloader
        await connection.client.flashBootloader(selectedBtlFile.value.data, {
          progress: (value) => {
            uploadProgress.value = value / 2 + 50;
          },
          reliable: true, // Don't take any chances with the bootloader upload
        });

        // Validate the bootloader's SHA-256
        const btlActualSHA = await connection.client.getDigest();
        if (!typedArraysEqual(btlExpectedSHA, btlActualSHA)) {
          console.warn('Bootloader upload failed: SHA-256 mismatch');
        } else {
          success = true;
          break;
        }
      } catch (e) {
        console.warn('Bootloader upload failed:', e);
      }

      // Retry after a short delay
      console.log('Retrying bootloader upload...');
      await new Promise((r) => setTimeout(r, 1000));
    }

    // LEAVE CRITICAL SECTION

    // This is a bricked device if we reach here
    if (!success) {
      console.error('Bootloader upload failed after 3 attempts, aborting.');
      return;
    }

    // Step 5: Reboot to have the new firmware moved to the primary slot
    await connection.client.reboot();

    // Step 6: Prompt the user to reconnect after the disconnect
  }

  return html`
    <div class="card">
      <div class="card-title connected">BOOTLOADER MIGRATION</div>

      <div class="card-body">
        <div>
          <label class="settings-row">
            App firmware
            <input type="file" accept=".bin" onChange=${appFileChange} ref=${appFile} />
          </label>

          <label class="settings-row">
            Bootloader firmware
            <input type="file" accept=".bin" onChange=${btlFileChange} ref=${btlFile} />
          </label>
        </div>
      </div>

      <div class="card-actions">
        <button class="secondary" onClick=${backButtonClick}>Back</button>
        ${selectedFilesValid.value &&
        html` <button class="primary" onClick=${uploadFirmwareClick}>Upload Firmware</button> `}
      </div>
    </div>
  `;
}
