import { connection } from '@/connection.js';
import { Page } from '@/Page.js';
import { typedArraysEqual } from '@/utils.js';

// WavePhoenix app firmware id
const APP_ID_TLV = 0xc001;
const WAVEPHOENIX_APP_MAGIC = new Uint8Array([0x57, 0x50]);

export class MigrationPage extends Page {
  #controller;
  #rebooting = false;

  #backBtn = document.getElementById('migration-back-btn');
  #flashBtn = document.getElementById('migration-flash-btn');
  #appFileInput = document.getElementById('migration-app-file');
  #btlFileInput = document.getElementById('migration-btl-file');

  constructor() {
    // Register the page
    super('migration-page');

    // Hook up event listeners
    this.#backBtn.addEventListener('click', this.backButtonClicked);
    this.#flashBtn.addEventListener('click', this.flashButtonClicked);
    this.#appFileInput.addEventListener('change', this.appFileChanged);
    this.#btlFileInput.addEventListener('change', this.btlFileChanged);
  }

  backButtonClicked = () => {
    connection.client.disconnect();
  };

  appFileChanged = async () => {
    const file = this.#appFileInput.files[0];
    const data = await file.arrayBuffer();
    const image = new MCUbootImage(data);

    if (!(await image.isValid())) {
      // this.#fileInfo.textContent = `Not a valid WavePhoenix firmware image`;
      // this.#fileName.textContent = fileName;
      // this.#fileSelected.classList.remove('hidden');
      return;
    }

    // Check if the image is a WavePhoenix app firmware
    if (!typedArraysEqual(image.getTLV(APP_ID_TLV), WAVEPHOENIX_APP_MAGIC)) {
      // this.#fileInfo.textContent = `Not a valid WavePhoenix firmware image`;
      // this.#fileName.textContent = fileName;
      // this.#fileSelected.classList.remove('hidden');
      return;
    }
  };

  btlFileChanged = () => {
    //
  };

  flashButtonClicked = async () => {
    // Last minute sanity checks
    const appFile = this.#appFileInput.files[0];
    const btlFile = this.#btlFileInput.files[0];
    if (!appFile || !btlFile) {
      console.error('No files selected');
      return;
    }

    // TODO: Validate application is a MCUboot image, and has a valid WavePhoenix app TLV
    // TODO: Validate the bootloader vs a whitelist of known good bootloaders

    // Step 1: Upload the new zephyr app firmware, and validate
    const appData = await appFile.arrayBuffer();
    const appExpectedSHA = new Uint8Array(await crypto.subtle.digest('SHA-256', appData));

    // Flash the app
    await connection.client.flashApp(appData, {
      progress: this.setProgress,
      signal: this.#controller.signal,
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

    const btlData = await btlFile.arrayBuffer();
    const btlExpectedSHA = new Uint8Array(await crypto.subtle.digest('SHA-256', btlData));

    // Try up to 3 times in case of failure
    let success = false;
    for (let i = 0; i < 3; i++) {
      try {
        // Flash the bootloader
        await connection.client.flashBootloader(btlData, {
          progress: this.setProgress,
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
    this.#rebooting = true;
    await connection.client.reboot();

    // Step 6: Prompt the user to reconnect after the disconnect
  };

  setProgress = (percent) => {
    console.log(`Upload progress: ${percent}%`);
  };

  clientDisconnected = async () => {
    // Client disconnected during expected reboot
    if (this.#rebooting) {
      this.#rebooting = false;

      // TODO: Show a prompt for the user to reconnect
      // We cannot do this automatically because the bluetooth id will have changed
      // and requestDevice must be initiated by a user interaction
      console.log('Client disconnected due to reboot');
      return;
    }

    Page.show('connect');
  };

  onShow() {
    // Reset the abort controller
    this.#controller = new AbortController();

    // Register disconnect handler
    connection.client.addDisconnectHandler(this.clientDisconnected);

    // Reset button states
    this.#backBtn.classList.remove('hidden');
  }

  onHide() {
    // Remove disconnect handler
    connection.client?.removeDisconnectHandler(this.clientDisconnected);
  }
}
