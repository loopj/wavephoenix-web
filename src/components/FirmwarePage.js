import { useSignal } from '@preact/signals';
import { html } from 'htm/preact';
import { useRef } from 'preact/hooks';

import { GeckoBootloaderImage } from 'gbl-tools';

import { MCUbootImage } from '@/MCUbootImage.js';
import { connection, useDisconnectHandler } from '@/connection.js';
import { showPage } from '@/nav.js';
import { bytesToUUIDString, semverToString, typedArraysEqual, uint32ToSemver } from '@/utils.js';

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
  const fileTargetActive = useSignal(false);

  // Refs
  const abortController = useRef(null);
  const fileInput = useRef(null);

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

  function fileTargetDragEnter(event) {
    event.preventDefault();
    fileTargetActive.value = true;
  }

  function fileTargetDragLeave() {
    fileTargetActive.value = false;
  }

  function fileTargetClick() {
    fileInput.current?.click();
  }

  function fileTargetDrop(event) {
    event.preventDefault();
    fileTargetActive.value = false;
    const file = event.dataTransfer.files[0];
    if (file) {
      fileReady(file);
    }
  }

  function fileInputChange(event) {
    const file = event.target.files[0];
    if (file) {
      fileReady(file);
    }
  }

  async function fileReady(file) {
    const name = file.name;
    const data = await file.arrayBuffer();
    if (connection.mode === 'management') {
      // Validate MCUboot images
      const image = new MCUbootImage(data);
      if (image.isValid() && typedArraysEqual(image.getTLV(APP_ID_TLV), WAVEPHOENIX_APP_ID)) {
        const version = image.getVersion();
        selectedFile.value = { name, data, version, type: 'zephyr' };
        return;
      }
    } else {
      // Validate GBL images
      const image = new GeckoBootloaderImage(data);
      if (image.isValid() && image.application) {
        const productId = bytesToUUIDString(image.application.productId);
        const version = uint32ToSemver(image.application.version);
        if (productId === MIGRATION_APP_UUID) {
          selectedFile.value = { name, data, version, type: 'migration' };
        } else if (productId === RECEIVER_APP_UUID) {
          selectedFile.value = { name, data, version, type: 'legacy' };
        }
        return;
      }
    }

    // Not a valid firmware image
    selectedFile.value = { name };
  }

  async function flashButtonClick() {
    // Set up abort controller
    abortController.current = new AbortController();

    // Start firmware upload
    try {
      step.value = 'uploading';
      uploadProgress.value = 0;

      await connection.client.flashFirmware(selectedFile.value.data, {
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
    if (selectedFile.value.type === 'zephyr' || selectedFile.value.type === 'legacy') {
      return `Selected WavePhoenix firmware version ${semverToString(selectedFile.value.version)}`;
    } else if (selectedFile.value.type === 'migration') {
      return `Selected WavePhoenix bootloader migration firmware`;
    } else {
      return 'Not a valid WavePhoenix firmware image';
    }
  }

  function FileSelector() {
    const fileExtension = connection.mode === 'management' ? '.bin' : '.gbl';

    return html`
      <input
        type="file"
        class="hidden"
        ref=${fileInput}
        onChange=${fileInputChange}
        accept=${fileExtension}
      />

      <div
        class=${fileTargetActive.value ? 'file-target active' : 'file-target'}
        onClick=${fileTargetClick}
        onDragEnter=${fileTargetDragEnter}
        onDragLeave=${fileTargetDragLeave}
        onDragOver=${(e) => e.preventDefault()}
        onDrop=${fileTargetDrop}
      >
        <p>
          <img src="images/upload.svg" class="upload-icon" />
        </p>
        <p>Drag a ${fileExtension} firmware file here, or click to pick one.</p>
      </div>

      ${selectedFile.value &&
      html`
        <div class="file-selected">
          <div class="file-info">${fileStatus()}</div>
          <div class="file-name">${selectedFile.value.name}</div>
        </div>
      `}
    `;
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
        ${step.value === 'selecting' && html`<${FileSelector} />`}
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
