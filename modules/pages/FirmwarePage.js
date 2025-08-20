import { TimeoutError, versionString } from "../ManagementClient.js";
import { MCUbootImage } from "../MCUbootImage.js";
import { Page, showPage } from "./Page.js";

const DFU_CHUNK_SIZE = 64;

export class FirmwarePage extends Page {
  #page = document.getElementById("firmware-page");

  // Button bar
  #backBtn = document.getElementById("firmware-back-btn");
  #flashBtn = document.getElementById("firmware-flash-btn");
  #cancelBtn = document.getElementById("firmware-cancel-btn");

  // File selection area
  #fileSelectionArea = document.getElementById("firmware-file-selection-area");
  #fileSelectionInfo = document.getElementById("firmware-file-selection-info");
  #fileInput = document.getElementById("firmware-file");
  #chooseBtn = document.getElementById("firmware-choose-btn");

  // File selected area
  #fileSelectedArea = document.getElementById("firmware-file-selected-area");
  #fileSelectedInfo = document.getElementById("firmware-file-selected-info");
  #changeBtn = document.getElementById("firmware-change-btn");

  // Upload progress area
  #progressArea = document.getElementById("firmware-progress-area");
  #progressInfo = document.getElementById("firmware-progress-info");
  #progressBarFill = document.querySelector("#firmware-progress-bar .progress-bar-fill");
  #progressBarText = document.querySelector("#firmware-progress-bar .progress-bar-text");
  #abortUpload = false;

  constructor(sharedState) {
    // Register the page
    super("firmware-page", sharedState);

    // Hook up event listeners
    this.#backBtn.addEventListener("click", this.backButtonClicked);
    this.#flashBtn.addEventListener("click", this.flashButtonClicked);
    this.#cancelBtn.addEventListener("click", this.cancelButtonClicked);
    this.#fileInput.addEventListener("change", this.fileInputChanged);
    this.#chooseBtn.addEventListener("click", this.chooseButtonClicked);
    this.#changeBtn.addEventListener("click", this.changeButtonClicked);
    this.#page.addEventListener("dragenter", this.pageDragEnter);
    this.#page.addEventListener("dragover", (e) => e.preventDefault());
    this.#page.addEventListener("dragleave", this.pageDragLeave);
    this.#page.addEventListener("drop", this.pageDropped);
  }

  chooseButtonClicked = () => {
    this.#fileInput.click();
  };

  changeButtonClicked = () => {
    this.#fileInput.click();
  };

  backButtonClicked = () => {
    if (this.client.connected) {
      showPage("menu");
    } else {
      showPage("connect");
    }
  };

  cancelButtonClicked = () => {
    this.#abortUpload = true;
    this.onShow();
  };

  pageDragEnter = (event) => {
    event.preventDefault();
    this.#page.classList.add("dragging");
  };

  pageDragLeave = (event) => {
    this.#page.classList.remove("dragging");
  };

  pageDropped = (event) => {
    event.preventDefault();
    this.#page.classList.remove("dragging");
    const file = event.dataTransfer.files[0];
    if (file) {
      this.#fileInput.files = event.dataTransfer.files;
      this.fileInputChanged();
    }
  };

  setProgress = (percent) => {
    this.#progressBarFill.style.width = percent + "%";
    this.#progressBarText.textContent = Math.round(percent) + "%";
  };

  fileInputChanged = async (event) => {
    // Return early if no file is selected
    if (this.#fileInput.files.length === 0) {
      console.error("No firmware file selected");
      return;
    }

    // Reset the file selection area
    this.#fileSelectionArea.classList.remove("hidden");
    this.#fileSelectedArea.classList.add("hidden");
    this.#flashBtn.classList.add("hidden");

    // Parse the firmware image
    const file = this.#fileInput.files[0];
    const firmwareImage = new MCUbootImage(await file.arrayBuffer());

    // Check if the firmware image is valid
    if (!firmwareImage.isValid()) {
      this.#fileSelectionInfo.textContent = `Invalid WavePhoenix firmware selected.`;
      return;
    }

    // Show the selected firmware information
    const version = versionString(firmwareImage.getVersion());
    this.#fileSelectedInfo.textContent = `Selected WavePhoenix firmware version ${version}`;

    // Toggle the "firmware selected" area
    this.#fileSelectionArea.classList.add("hidden");
    this.#fileSelectedArea.classList.remove("hidden");

    // Show the flash button
    this.#flashBtn.classList.remove("hidden");
  };

  flashButtonClicked = async () => {
    // Check if a file is selected
    if (this.#fileInput.files.length === 0) {
      console.error("No selected file!");
      return;
    }

    // Show progress area
    this.#progressArea.classList.remove("hidden");
    this.#fileSelectedArea.classList.add("hidden");

    // Hide flash and back buttons
    this.#flashBtn.classList.add("hidden");
    this.#backBtn.classList.add("hidden");

    // Show cancel button
    this.#cancelBtn.classList.remove("hidden");

    // Reset abort flag
    this.#abortUpload = false;

    // Start the DFU process
    const file = this.#fileInput.files[0];
    const buffer = await file.arrayBuffer();

    try {
      // Step 1: Send DFU_BEGIN command
      await this.client.beginDFU();

      // Step 2: Send firmware data in chunks
      const total = buffer.byteLength;
      for (let start = 0; start < total; start += DFU_CHUNK_SIZE) {
        // Check for cancellation
        if (this.#abortUpload) return;

        // Write the next chunk
        const chunk = buffer.slice(start, start + DFU_CHUNK_SIZE);
        await this.client.writeFirmware(chunk, { withResponse: false });

        // Update progress
        this.setProgress(Math.min((start / total) * 100, 99));
      }
    } catch (error) {
      await this.updateComplete(false);
      console.error("Firmware update failed:", error);
      return;
    }

    // Replace the disconnect handler temporarily to reconnect after firmware update
    const prevHandler = this.client.setDisconnectCallback(async () => {
      this.client.setDisconnectCallback(prevHandler);
      await this.reconnect();
    });

    // Step 3: Apply the firmware update
    await this.client.applyDFU();
  };

  async reconnect() {
    // Attempt to reconnect
    try {
      await this.client.connect();
      await this.updateComplete(true);
      return;
    } catch (error) {
      if (!(error instanceof TimeoutError)) throw error;
    }

    // Handle reconnection failure
    await this.client.disconnect();
    await this.updateComplete(false);

    console.error("Failed to reconnect after firmware update");
  }

  async updateComplete(success) {
    this.setProgress(100);

    this.#cancelBtn.classList.add("hidden");
    this.#backBtn.classList.remove("hidden");

    if (!success) {
      this.#progressInfo.textContent = "Firmware update failed.";
      return;
    }

    this.#progressInfo.textContent = "Firmware update complete!";
    await this.client.fetchVersion();

    // TODO: Check if expected version matches actual version
  }

  onShow() {
    // Reset the file input
    this.#fileInput.value = "";

    // Show only the file selection area
    this.#fileSelectionArea.classList.remove("hidden");
    this.#fileSelectedArea.classList.add("hidden");
    this.#progressArea.classList.add("hidden");

    // Reset text content
    this.#fileSelectionInfo.textContent = "Select or drag a firmware file to update your device.";
    this.#progressInfo.textContent =
      "Firmware update in progress. Do not disconnect or power off your device until the update is complete.";

    // Reset progress bar
    this.setProgress(0);

    // Reset button states
    this.#backBtn.classList.remove("hidden");
    this.#flashBtn.classList.add("hidden");
    this.#cancelBtn.classList.add("hidden");
  }
}
