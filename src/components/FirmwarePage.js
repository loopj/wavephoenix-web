import { useSignal } from '@preact/signals';
import { html } from 'htm/preact';
import { useRef } from 'preact/hooks';

import { GeckoBootloaderImage } from 'gbl-tools';

import { MCUbootImage } from '@/MCUbootImage.js';
import { connection, useDisconnectHandler } from '@/connection.js';
import { showPage } from '@/nav.js';
import { bytesToUUIDString, semverToString, typedArraysEqual, uint32ToSemver } from '@/utils.js';
import { FileSelector } from '@/components/FileSelector.js';

// GBL product IDs
const RECEIVER_APP_UUID = 'cb39eacc-7190-4435-8f77-fced4d0b96eb';
const MIGRATION_APP_UUID = 'd9478783-0b31-6b07-c387-878eb96c77a0';

// WavePhoenix app firmware id
const APP_ID_TLV = 0xc001;
const WAVEPHOENIX_APP_ID = new Uint8Array([0x57, 0x50]);

export function FirmwarePage() {
  // Signals
  const step = useSignal('selecting');
  const selectedFile = useSignal(null);
  const uploadProgress = useSignal(0);
  let reliableUpload = false;

  // Refs
  const abortController = useRef(null);

  useDisconnectHandler(() => {
    // Client disconnected during flashing firmware, let GATT failure handle state
    if (step.value === 'uploading') {
      return;
    }

    showPage('connect');
  });

  function backButtonClick() {
    if (connection.client.connected) {
      showPage('menu');
    } else {
      showPage('connect');
    }
  }

  function cancelButtonClick() {
    abortController.current?.abort();
  }

  async function rebootButtonClick() {
    if (connection.mode === 'management') {
      await connection.client.reboot();
    } else {
      connection.client.disconnect();
    }
  }

  async function validateFirmwareFile(file) {
    if (connection.mode === 'management') {
      // Validate MCUboot images
      const data = await file.arrayBuffer();
      const image = new MCUbootImage(data);

      if (!image.isValid()) {
        return { message: 'Not a valid MCUboot image' };
      }

      if (!typedArraysEqual(image.getTLV(APP_ID_TLV), WAVEPHOENIX_APP_ID)) {
        return { message: 'Not a valid WavePhoenix firmware image' };
      }
    } else {
      // Validate GBL images
      const data = await file.arrayBuffer();
      const image = new GeckoBootloaderImage(data, false);

      try {
        image.parse();
      } catch (e) {
        return { message: 'Could not parse GBL file' };
      }

      if (!image.isValid()) {
        return { message: 'Not a valid GBL image' };
      }

      if (!image.application) {
        return { message: 'GBL image does not contain an application' };
      }

      const productId = bytesToUUIDString(image.application.productId);
      if (productId !== MIGRATION_APP_UUID && productId !== RECEIVER_APP_UUID) {
        return { message: 'Not a valid WavePhoenix firmware image' };
      }
    }
  }

  async function onFileAccepted(file) {
    if (connection.mode === 'management') {
      // MCUboot images
      const image = new MCUbootImage(await file.arrayBuffer());
      const version = image.getVersion();
      selectedFile.value = { file, version, type: 'zephyr' };
    } else {
      // GBL images
      const image = new GeckoBootloaderImage(await file.arrayBuffer());
      const productId = bytesToUUIDString(image.application.productId);
      const version = uint32ToSemver(image.application.version);
      if (productId === MIGRATION_APP_UUID) {
        selectedFile.value = { file, version, type: 'migration' };
      } else if (productId === RECEIVER_APP_UUID) {
        selectedFile.value = { file, version, type: 'legacy' };
      }
    }
  }

  function onFileRejected(file, error) {
    // Mark file as rejected with error info
    selectedFile.value = { file, error };
  }

  async function flashButtonClick() {
    // Set up abort controller
    abortController.current = new AbortController();

    // Start firmware upload
    try {
      step.value = 'uploading';
      uploadProgress.value = 0;

      const data = await selectedFile.value.file.arrayBuffer();
      await connection.client.flashFirmware(data, {
        reliable: reliableUpload,
        progress: (value) => {
          uploadProgress.value = value;
        },
        signal: abortController.current.signal,
      });
    } catch (e) {
      if (e.name === 'AbortError') {
        // User canceled the firmware update
        step.value = 'selecting';
        selectedFile.value = null;
      } else {
        // Unexpected error
        console.log('Firmware update failed:', e);
        step.value = 'failed';
      }
      return;
    }

    // Upload complete
    step.value = 'completed';
  }

  function fileStatus() {
    if (selectedFile.value.error) {
      return 'Not a valid WavePhoenix firmware image';
    } else if (selectedFile.value.type === 'zephyr' || selectedFile.value.type === 'legacy') {
      return `WavePhoenix Firmware v${semverToString(selectedFile.value.version)}`;
    } else if (selectedFile.value.type === 'migration') {
      return `Bootloader Migration Firmware, v${semverToString(selectedFile.value.version)}`;
    }
  }

  function uploadModeChange(event) {
    reliableUpload = event.target.checked;
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
      <div class="card-title connected">FIRMWARE UPDATE</div>

      <div class="card-body">
        ${step.value === 'selecting' &&
        html`
          <${FileSelector}
            fileExtension=${connection.mode === 'management' ? '.bin' : '.gbl'}
            validator=${validateFirmwareFile}
            onFileAccepted=${onFileAccepted}
            onFileRejected=${onFileRejected}
          >
            <img src="images/upload.svg" class="upload-icon" />
            <p>Drag a ${
              connection.mode === 'management' ? '.bin' : '.gbl'
            } firmware file here, or click to pick one.</p>

            ${
              selectedFile.value &&
              html`
                <div class="file-selected">
                  <div class="file-name">${selectedFile.value.file.name}</div>
                  <div class="file-info">${fileStatus()}</div>
                </div>
              `
            }
          </${FileSelector}>

          <p>
            <label class="toggle-row">
              <input type="checkbox" onChange=${uploadModeChange}/> Upload using a slower but more reliable method
            </label>
          </p>
        `}
        ${step.value === 'uploading' && html`<${UploadProgress} />`}
        ${step.value === 'completed' && html`<p>Firmware update successful!</p>`}
        ${step.value === 'failed' && html`<p>Firmware update failed.</p>`}
      </div>

      <div class="card-actions">
        ${(step.value === 'selecting' || step.value === 'failed') &&
        html` <button onClick=${backButtonClick} class="secondary">Back</button> `}
        ${step.value === 'selecting' &&
        selectedFile.value?.type &&
        html` <button onClick=${flashButtonClick} class="primary">Flash Firmware</button> `}
        ${step.value === 'uploading' &&
        html` <button onClick=${cancelButtonClick} class="secondary">Cancel</button> `}
        ${step.value === 'completed' &&
        html` <button onClick=${rebootButtonClick} class="primary">Reboot Device</button> `}
      </div>
    </div>
  `;
}
