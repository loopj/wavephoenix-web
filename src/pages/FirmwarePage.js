import { GeckoBootloaderImage } from 'https://esm.sh/gbl-tools';
import { connection } from '@/connection.js';
import { MCUbootImage } from '@/MCUbootImage.js';
import { Page } from '@/Page.js';
import { bytesToUUIDString, semverToString, typedArraysEqual, uint32ToSemver } from '@/utils.js';

// GBL product IDs
const RECEIVER_APP_UUID = 'cb39eacc-7190-4435-8f77-fced4d0b96eb';
const MIGRATION_APP_UUID = 'd9478783-0b31-6b07-c387-878eb96c77a0';

// WavePhoenix app firmware id
const APP_ID_TLV = 0xc001;
const WAVEPHOENIX_APP_MAGIC = new Uint8Array([0x57, 0x50]);

export class FirmwarePage extends Page {
  #controller;
  #rebooting = false;
  #flashing = false;
  #fileInput = document.getElementById('firmware-file');

  // Button bar
  #backBtn = document.getElementById('firmware-back-btn');
  #flashBtn = document.getElementById('firmware-flash-btn');
  #cancelBtn = document.getElementById('firmware-cancel-btn');
  #rebootBtn = document.getElementById('firmware-reboot-btn');

  // File selection area
  #fileArea = document.getElementById('firmware-file-area');
  #fileTarget = document.getElementById('firmware-file-target');
  #filePrompt = document.getElementById('firmware-file-prompt');
  #fileSelected = document.getElementById('firmware-file-selected');
  #fileInfo = document.getElementById('firmware-file-info');
  #fileName = document.getElementById('firmware-file-name');

  // Upload progress area
  #progressArea = document.getElementById('firmware-progress-area');
  #progressInfo = document.getElementById('firmware-progress-info');
  #progressBarFill = document.querySelector('#firmware-progress-bar .progress-bar-fill');
  #progressBarText = document.querySelector('#firmware-progress-bar .progress-bar-text');

  constructor() {
    // Register the page
    super('firmware-page');

    // Hook up event listeners
    this.#backBtn.addEventListener('click', this.backButtonClicked);
    this.#flashBtn.addEventListener('click', this.flashButtonClicked);
    this.#cancelBtn.addEventListener('click', this.cancelButtonClicked);
    this.#rebootBtn.addEventListener('click', this.rebootButtonClicked);
    this.#fileInput.addEventListener('change', this.fileInputChanged);
    this.#fileTarget.addEventListener('click', this.fileTargetClicked);
    this.#fileTarget.addEventListener('mouseover', this.fileTargetActive);
    this.#fileTarget.addEventListener('mouseout', this.fileTargetInactive);
    this.#fileTarget.addEventListener('dragenter', this.fileTargetActive);
    this.#fileTarget.addEventListener('dragleave', this.fileTargetInactive);
    this.#fileTarget.addEventListener('dragover', (e) => e.preventDefault());
    this.#fileTarget.addEventListener('drop', this.fileTargetDropped);
  }

  backButtonClicked = () => {
    if (connection.client.connected) {
      Page.show('menu');
    } else {
      Page.show('connect');
    }
  };

  cancelButtonClicked = () => {
    this.#controller.abort();
  };

  rebootButtonClicked = () => {
    connection.client.disconnect();
  };

  fileTargetActive = (event) => {
    event.preventDefault();
    this.#fileTarget.classList.add('active');
  };

  fileTargetInactive = () => {
    this.#fileTarget.classList.remove('active');
  };

  fileTargetClicked = () => {
    this.#fileInput.click();
  };

  fileTargetDropped = (event) => {
    event.preventDefault();
    this.#fileTarget.classList.remove('active');
    const file = event.dataTransfer.files[0];
    if (file) {
      this.#fileInput.files = event.dataTransfer.files;
      this.fileInputChanged();
    }
  };

  setProgress = (percent) => {
    this.#progressBarFill.style.width = `${percent}%`;
    this.#progressBarText.textContent = `${Math.round(percent)}%`;
  };

  fileInputChanged = async () => {
    // Return early if no file is selected
    if (this.#fileInput.files.length === 0) {
      console.error('No firmware file selected');
      return;
    }

    // Reset the file area
    this.#fileArea.classList.remove('hidden');
    this.#flashBtn.classList.add('hidden');

    // Parse the firmware image
    const file = this.#fileInput.files[0];
    const fileName = file.name;
    const fileData = await file.arrayBuffer();

    if (connection.mode === 'legacy') {
      const firmwareImage = new GeckoBootloaderImage(fileData);
      if (!firmwareImage.isValid() || !firmwareImage.application) {
        this.#fileInfo.textContent = `Not a valid WavePhoenix firmware image`;
        this.#fileName.textContent = fileName;
        this.#fileSelected.classList.remove('hidden');
        return;
      }

      const productId = bytesToUUIDString(firmwareImage.application.productId);
      if (productId === MIGRATION_APP_UUID) {
        this.#fileInfo.textContent = `Selected WavePhoenix bootloader migration firmware`;
        this.#fileName.textContent = fileName;
        this.#fileSelected.classList.remove('hidden');
      } else if (productId === RECEIVER_APP_UUID) {
        const version = uint32ToSemver(firmwareImage.application.version);
        this.#fileInfo.textContent = `Selected WavePhoenix firmware version ${semverToString(version)}`;
        this.#fileName.textContent = fileName;
        this.#fileSelected.classList.remove('hidden');
      } else {
        this.#fileInfo.textContent = `Not a valid WavePhoenix firmware image`;
        this.#fileName.textContent = fileName;
        this.#fileSelected.classList.remove('hidden');
        return;
      }
    } else {
      // Check if the file is a valid MCUboot image
      const firmwareImage = new MCUbootImage(fileData);
      if (!(await firmwareImage.isValid())) {
        this.#fileInfo.textContent = `Not a valid WavePhoenix firmware image`;
        this.#fileName.textContent = fileName;
        this.#fileSelected.classList.remove('hidden');
        return;
      }

      // Check if the image is a WavePhoenix app firmware
      if (!typedArraysEqual(firmwareImage.getTLV(APP_ID_TLV), WAVEPHOENIX_APP_MAGIC)) {
        this.#fileInfo.textContent = `Not a valid WavePhoenix firmware image`;
        this.#fileName.textContent = fileName;
        this.#fileSelected.classList.remove('hidden');
        return;
      }

      // Show the selected firmware information
      const version = firmwareImage.getVersion();
      this.#fileInfo.textContent = `Selected WavePhoenix firmware version ${semverToString(version)}`;
      this.#fileName.textContent = fileName;
      this.#fileSelected.classList.remove('hidden');
    }

    // Show the flash button
    this.#flashBtn.classList.remove('hidden');
  };

  flashButtonClicked = async () => {
    // Check if a file is selected
    if (this.#fileInput.files.length === 0) {
      console.error('No selected file!');
      return;
    }

    // Show progress area
    this.#progressArea.classList.remove('hidden');
    this.#fileArea.classList.add('hidden');

    // Hide flash and back buttons
    this.#flashBtn.classList.add('hidden');
    this.#backBtn.classList.add('hidden');

    // Show cancel button
    this.#cancelBtn.classList.remove('hidden');

    // Start the DFU process
    const file = this.#fileInput.files[0];
    const fileData = await file.arrayBuffer();

    try {
      this.#flashing = true;
      await connection.client.flashFirmware(fileData, {
        progress: this.setProgress,
        signal: this.#controller.signal,
      });
    } catch (e) {
      if (e.name === 'AbortError') {
        // User canceled the firmware update
        this.onShow();
      } else {
        // Unexpected error
        this.updateFailed(e);
      }
      return;
    } finally {
      this.#flashing = false;
    }

    if (connection.mode === 'legacy') {
      // Legacy mode will reboot the device when the bluetooth client disconnects
      this.updateComplete();
    } else {
      // Request a device reboot
      this.#rebooting = true;
      await connection.client.reboot();
    }
  };

  updateComplete() {
    this.setProgress(100);

    this.#cancelBtn.classList.add('hidden');
    this.#progressInfo.textContent = 'Firmware update complete!';

    // In legacy mode we need to prompt to reboot
    // In management mode, we have already rebooted into the new version by this point
    if (connection.mode === 'legacy') {
      this.#rebootBtn.classList.remove('hidden');
    } else {
      this.#backBtn.classList.remove('hidden');
      // TODO: Check if expected version matches actual version
    }
  }

  updateFailed(e) {
    if (e) {
      console.error('Error flashing firmware:', e);
    }

    this.#cancelBtn.classList.add('hidden');
    this.#backBtn.classList.remove('hidden');
    this.#progressInfo.textContent = 'Firmware update failed.';
  }

  clientDisconnected = async () => {
    // Client disconnected during flashing firmware, let GATT failure handle state
    if (this.#flashing) {
      this.#flashing = false;
      return;
    }

    // Client disconnected during expected reboot, attempting to reconnect
    if (this.#rebooting) {
      this.#rebooting = false;

      // Attempt to reconnect
      try {
        await connection.client.connect();
        this.updateComplete();
      } catch (e) {
        connection.client.disconnect();
        this.updateFailed();
        console.error('Failed to reconnect after firmware update', e);
      }
      return;
    }

    Page.show('connect');
  };

  onShow() {
    // Register disconnect handler
    connection.client.addDisconnectHandler(this.clientDisconnected);

    // Reset the file input
    const fileExtension = connection.mode === 'legacy' ? '.gbl' : '.bin';
    this.#fileInput.value = '';
    this.#fileInput.accept = fileExtension;

    // Reset the abort controller
    this.#controller = new AbortController();

    // Show only the file selection area
    this.#fileArea.classList.remove('hidden');
    this.#progressArea.classList.add('hidden');
    this.#fileSelected.classList.add('hidden');

    // Reset text content
    this.#filePrompt.textContent = `Drag a ${fileExtension} firmware file here, or click to pick one.`;
    this.#progressInfo.textContent =
      'Firmware update in progress. Do not disconnect or power off your device until the update is complete.';

    // Reset progress bar
    this.setProgress(0);

    // Reset button states
    this.#backBtn.classList.remove('hidden');
    this.#flashBtn.classList.add('hidden');
    this.#cancelBtn.classList.add('hidden');
    this.#rebootBtn.classList.add('hidden');
  }

  onHide() {
    // Remove disconnect handler
    connection.client.removeDisconnectHandler(this.clientDisconnected);
  }
}
