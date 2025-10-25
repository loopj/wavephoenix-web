import { useComputed, useSignal } from '@preact/signals';
import { html } from 'htm/preact';
import { useEffect } from 'preact/hooks';

import { MCUbootImage } from '@/MCUbootImage.js';

import { connection, useDisconnectHandler } from '@/connection.js';
import { showPage } from '@/nav.js';
import { semverToString, sha256BytesToString, typedArraysEqual } from '@/utils.js';

import { FileSelector } from './FileSelector.js';

// WavePhoenix bootloader versions by SHA-256
const BOOTLOADER_VERSIONS = {
  '839b035dcddddd422848df8c116622b57f961061a53388e68ecee49fbff15597': {
    version: {
      major: 0,
      minor: 10,
      patch: 0,
    },
    board: 'minireceiver',
  },
};

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

  // Prevent accidental tab close/reload during critical sections
  useEffect(() => {
    if (!['uploading', 'failed-btl'].includes(step.value)) return;

    const handleBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [step.value]);

  useDisconnectHandler(() => {
    showPage('connect');
  });

  function backButtonClick() {
    connection.client.disconnect();
  }

  async function rebootButtonClick() {
    await connection.client.reboot();
  }

  function retryButtonClick() {
    step.value = 'selecting';
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
    const data = await file.arrayBuffer();
    const image = new MCUbootImage(data);
    const version = image.getVersion();

    selectedAppFile.value = { file, version, type: 'zephyr' };
  }

  async function onAppFileRejected(file, error) {
    selectedAppFile.value = { file, error };
  }

  function btlFileStatus() {
    if (selectedBtlFile.value.error) {
      return 'Not a valid bootloader image';
    } else if (selectedBtlFile.value.type === 'bootloader') {
      return `WavePhoenix Bootloader, v${semverToString(selectedBtlFile.value.version)}`;
    }
  }

  async function validateBtlFile(file) {
    const data = await file.arrayBuffer();
    const btlSHABytes = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
    const btlSHA = sha256BytesToString(btlSHABytes);

    if (!BOOTLOADER_VERSIONS[btlSHA]) {
      return { message: 'Unknown bootloader image' };
    }
  }

  async function onBtlFileAccepted(file) {
    const data = await file.arrayBuffer();
    const btlSHABytes = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
    const btlSHA = sha256BytesToString(btlSHABytes);

    selectedBtlFile.value = {
      file,
      type: 'bootloader',
      version: BOOTLOADER_VERSIONS[btlSHA].version,
    };
  }

  async function onBtlFileRejected(file, error) {
    selectedBtlFile.value = { file, error };
  }

  async function uploadFirmwareClick() {
    // Reset progress
    step.value = 'uploading';
    uploadProgress.value = 0;

    // Step 1: Upload the new zephyr app firmware, and validate
    const appData = await selectedAppFile.value.file.arrayBuffer();
    const appExpectedSHA = new Uint8Array(await crypto.subtle.digest('SHA-256', appData));

    // Flash the app
    try {
      await connection.client.flashApp(appData, {
        progress: (value) => {
          uploadProgress.value = value / 2;
        },
      });
    } catch (error) {
      console.error('App upload failed:', error);
      step.value = 'failed-app';
      return;
    }

    // Validate the app's SHA-256
    const appActualSHA = await connection.client.getDigest();
    if (!typedArraysEqual(appExpectedSHA, appActualSHA)) {
      console.error('App upload failed: SHA-256 mismatch');
      step.value = 'failed-app';
      return;
    }

    // Step 2: Upload the new MCUboot bootloader firmware, and validate
    // ENTER CRITICAL SECTION - DO NOT DISCONNECT UNTIL BOOTLOADER IS UPLOADED AND VALIDATED
    const btlData = await selectedBtlFile.value.file.arrayBuffer();
    const btlExpectedSHA = new Uint8Array(await crypto.subtle.digest('SHA-256', btlData));

    // Try up to 3 times in case of failure
    let success = false;
    for (let i = 0; i < 3; i++) {
      try {
        // Flash the bootloader
        await connection.client.flashBootloader(btlData, {
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

    // If we reach here it means the bootloader upload failed after multiple retries
    // If the user disconnects now, they may brick their device
    if (!success) {
      console.error('Bootloader upload failed after 3 attempts, aborting.');
      step.value = 'failed-btl';
      return;
    }

    // Step 5: Prompt the user to reboot to have the new firmware moved to the primary slot
    step.value = 'completed';
  }

  function UploadProgress() {
    return html`
      <p>
        Bootloader migration in progress. Do not disconnect or power off your device until the
        update is complete.
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
            Make sure your WavePhoenix is very close to your computer and do not disconnect your device until the update is complete.
          </p>
          <p>
            Select both an app firmware and bootloader to continue.
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
                <div class="file-name">${selectedAppFile.value.file.name}</div>
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
                <div class="file-name">${selectedBtlFile.value.file.name}</div>
                <div class="file-info">${btlFileStatus()}</div>
              </div>`
            }
          </${FileSelector}>
        `}
        ${step.value === 'uploading' && html`<${UploadProgress} />`}
        ${step.value === 'failed-app' && html`<p>Bootloader migration failed.</p>`}
        ${step.value === 'failed-btl' &&
        html`<p>Bootloader migration failed.</p>
          <p>The bootloader failed to upload after multiple retries.</p>
          <p class="warning">
            If you unplug your WavePhoenix at this point, you may no longer be able to flash
            firmware using Bluetooth. It is strongly recommended that you keep your device connected
            and try again.
          </p>`}
        ${step.value === 'completed' &&
        html`<p>Upload complete, reboot your device to complete the migration.</p>`}
      </div>

      <div class="card-actions">
        ${step.value === 'selecting' &&
        html` <button onClick=${backButtonClick} class="secondary">Back</button> `}
        ${step.value === 'selecting' &&
        selectedFilesValid.value &&
        html` <button class="primary" onClick=${uploadFirmwareClick}>Begin Migration</button> `}
        ${step.value === 'completed' &&
        html` <button onClick=${rebootButtonClick} class="primary">Reboot Device</button> `}
        ${(step.value === 'failed-app' || step.value === 'failed-btl') &&
        html` <button onClick=${retryButtonClick} class="primary">Retry</button> `}
      </div>
    </div>
  `;
}
