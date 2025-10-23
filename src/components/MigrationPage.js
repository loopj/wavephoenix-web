import { useComputed, useSignal } from '@preact/signals';
import { html } from 'htm/preact';
import { useRef } from 'preact/hooks';

import { MCUbootImage } from '@/MCUbootImage.js';

import { connection, useDisconnectHandler } from '@/connection.js';
import { showPage } from '@/nav.js';
import { semverToString, typedArraysEqual } from '@/utils.js';

import { FileSelector } from './FileSelector.js';

// WavePhoenix app firmware id
const APP_ID_TLV = 0xc001;
const WAVEPHOENIX_APP_ID = new Uint8Array([0x57, 0x50]);

export function MigrationPage() {
  const step = useSignal('selecting');
  const selectedAppFile = useSignal(null);
  const selectedBtlFile = useSignal(null);
  const uploadProgress = useSignal(0);

  const selectedFilesValid = useComputed(() => {
    return !!selectedAppFile.value?.type && !!selectedBtlFile.value?.type;
  });

  useDisconnectHandler(() => {
    showPage('connect');
  });

  function backButtonClick() {
    connection.client.disconnect();
  }

  function appFileStatus() {
    if (selectedAppFile.value.error) {
      return 'Not a valid WavePhoenix firmware image';
    } else if (selectedAppFile.value.type === 'zephyr') {
      return `WavePhoenix Firmware, v${semverToString(selectedAppFile.value.version)}`;
    }
  }

  async function validateAppFile(file) {
    // Validate MCUboot images
    const data = await file.arrayBuffer();
    const image = new MCUbootImage(data);

    if (!image.isValid()) {
      return { message: 'Not a valid MCUboot image' };
    }

    if (!typedArraysEqual(image.getTLV(APP_ID_TLV), WAVEPHOENIX_APP_ID)) {
      return { message: 'Not a valid WavePhoenix firmware image' };
    }
  }

  async function onAppFileAccepted(file) {
    const name = file.name;
    const data = await file.arrayBuffer();
    const image = new MCUbootImage(data);
    const version = image.getVersion();
    selectedAppFile.value = { name, data, version, type: 'zephyr' };
  }

  async function onAppFileRejected(file, error) {
    selectedAppFile.value = { name: file.name, error: error };
  }

  function btlFileStatus() {
    if (selectedBtlFile.value.error) {
      return 'Not a valid bootloader image';
    } else if (selectedBtlFile.value.type === 'zephyr') {
      return 'WavePhoenix bootloader image';
    }
  }

  async function validateBtlFile(file) {
    // TODO: Validate the bootloader SHA256 vs a whitelist of known good bootloaders
  }

  async function onBtlFileAccepted(file) {
    selectedBtlFile.value = { name: file.name, data: await file.arrayBuffer(), type: 'zephyr' };
  }

  async function onBtlFileRejected(file, error) {
    selectedBtlFile.value = { name: file.name, error: error };
  }

  async function uploadFirmwareClick() {
    // Reset progress
    step.value = 'uploading';
    uploadProgress.value = 0;

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

  function UploadProgress() {
    return html`
      <p>
        Firmware update in progress. Do not disconnect or power off your device until the update is
        complete.
      </p>

      <div class="progress-bar">
        <div class="progress-bar-fill" style="width: ${uploadProgress}%"></div>
        <div class="progress-bar-text">${Math.round(uploadProgress)}%</div>
      </div>
    `;
  }

  return html`
    <div class="card">
      <div class="card-title connected">BOOTLOADER MIGRATION</div>

      <div class="card-body">
        ${step.value === 'selecting' &&
        html`
          <p>
            Please select both an app firmware and a bootloader to proceed with bootloader
            migration.
          </p>

          <${FileSelector}
            fileExtension=".bin"
            validator=${validateAppFile}
            onFileAccepted=${onAppFileAccepted}
            onFileRejected=${onAppFileRejected}
          >
            <p>Drag app firmware here, or click to pick one.</p>
            ${
              selectedAppFile.value &&
              html`<div class="file-selected">
                <div class="file-name">${selectedAppFile.value.name}</div>
                <div class="file-info">${appFileStatus()}</div>
              </div>`
            }
          </${FileSelector}>

          <p></p>

          <${FileSelector}
            fileExtension=".bin"
            validator=${validateBtlFile}
            onFileAccepted=${onBtlFileAccepted}
            onFileRejected=${onBtlFileRejected}
          >
            <p>Drag bootloader here, or click to pick one.</p>
            ${
              selectedBtlFile.value &&
              html`<div class="file-selected">
                <div class="file-name">${selectedBtlFile.value.name}</div>
                <div class="file-info">${btlFileStatus()}</div>
              </div>`
            }
          </${FileSelector}>
        `}
        ${step.value === 'uploading' && html`<${UploadProgress} />`}
      </div>

      <div class="card-actions">
        ${(step.value === 'selecting' || step.value === 'failed') &&
        html` <button onClick=${backButtonClick} class="secondary">Back</button> `}
        ${step.value === 'selecting' &&
        selectedFilesValid.value &&
        html` <button class="primary" onClick=${uploadFirmwareClick}>Begin Migration</button> `}
      </div>
    </div>
  `;
}
