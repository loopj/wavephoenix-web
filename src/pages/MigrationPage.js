import { connection } from '@/connection.js';
import { Page } from '@/Page.js';

function validateSHA256(expectedBuf, actualBuf) {
  if (expectedBuf.byteLength !== 32 || actualBuf.byteLength !== 32) return false;

  const expected = new Uint8Array(expectedBuf);
  const actual = new Uint8Array(actualBuf);

  return expected.every((v, i) => v === actual[i]);
}

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
  }

  backButtonClicked = () => {
    connection.client.disconnect();
  };

  flashButtonClicked = async () => {
    const appFile = this.#appFileInput.files[0];
    if (!appFile) {
      alert('Please select an app file to upload.');
      return;
    }

    const btlFile = this.#btlFileInput.files[0];
    if (!btlFile) {
      alert('Please select a bootloader file to upload.');
      return;
    }

    // Step 1: Upload the new zephyr app firmware
    const appData = await appFile.arrayBuffer();
    await connection.client.flashApp(appData, {
      progress: this.setProgress,
      signal: this.#controller.signal,
    });

    // Step 2: Validate the uploaded app's SHA-256
    const appExpectedSHA = await crypto.subtle.digest('SHA-256', appData);
    const appActualSHA = await connection.client.getDigest();
    if (!validateSHA256(appExpectedSHA, appActualSHA)) {
      console.error('Application upload failed: SHA-256 mismatch.');
      // TODO: Just fail and have user initiate upload again
      return;
    }

    // Step 3: Upload the new MCUboot bootloader firmware
    const btlData = await btlFile.arrayBuffer();
    await connection.client.flashBootloader(btlData, {
      progress: this.setProgress,
      signal: this.#controller.signal,
    });

    // Step 4: Validate the uploaded bootloader's SHA-256
    const btlExpectedSHA = await crypto.subtle.digest('SHA-256', btlData);
    const btlActualSHA = await connection.client.getDigest();
    if (!validateSHA256(btlExpectedSHA, btlActualSHA)) {
      console.error('Bootloader upload failed: SHA-256 mismatch.');
      // TODO: Retry automatically, this is a critical failure
      // DO NOT DISCONNECT AT THIS POINT
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
