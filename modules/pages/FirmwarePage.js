import { MCUbootImage } from "@/images/MCUbootImage.js";
import { versionString } from "@/utils.js";

import { Page } from "./Page.js";

export class FirmwarePage extends Page {
  #controller;
  #rebooting = false;
  #flashing = false;
  #page = document.getElementById("firmware-page");
  #fileInput = document.getElementById("firmware-file");

  // Button bar
  #backBtn = document.getElementById("firmware-back-btn");
  #flashBtn = document.getElementById("firmware-flash-btn");
  #cancelBtn = document.getElementById("firmware-cancel-btn");

  // File selection area
  #fileSelectionArea = document.getElementById("firmware-file-selection-area");
  #fileSelectionInfo = document.getElementById("firmware-file-selection-info");
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

  constructor() {
    // Register the page
    super("firmware-page");

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
      Page.show("menu");
    } else {
      Page.show("connect");
    }
  };

  cancelButtonClicked = () => {
    this.#controller.abort();
  };

  pageDragEnter = (event) => {
    event.preventDefault();
    this.#page.classList.add("dragging");
  };

  pageDragLeave = () => {
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
    this.#progressBarFill.style.width = `${percent}%`;
    this.#progressBarText.textContent = `${Math.round(percent)}%`;
  };

  fileInputChanged = async () => {
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

    // Start the DFU process
    const file = this.#fileInput.files[0];
    const buffer = await file.arrayBuffer();

    try {
      this.#flashing = true;
      await this.client.writeFirmware(buffer, {
        progress: this.setProgress,
        signal: this.#controller.signal,
      });
    } catch (e) {
      if (e.name === "AbortError") {
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

    // Request a device reboot
    this.#rebooting = true;
    await this.client.reboot();
  };

  async updateComplete() {
    this.setProgress(100);

    this.#cancelBtn.classList.add("hidden");
    this.#backBtn.classList.remove("hidden");
    this.#progressInfo.textContent = "Firmware update complete!";

    await this.client.fetchVersion();

    // TODO: Check if expected version matches actual version
  }

  async updateFailed(e) {
    if (e) {
      console.error("Error flashing firmware:", e);
    }

    this.#cancelBtn.classList.add("hidden");
    this.#backBtn.classList.remove("hidden");
    this.#progressInfo.textContent = "Firmware update failed.";
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
        await this.client.connect();
        await this.updateComplete();
      } catch (e) {
        await this.client.disconnect();
        await this.updateFailed();
        console.error("Failed to reconnect after firmware update", e);
      }
      return;
    }

    Page.show("connect");
  };

  onShow() {
    // Register disconnect handler
    this.client.addDisconnectHandler(this.clientDisconnected);

    // Reset the file input and abort controller
    this.#fileInput.value = "";
    this.#controller = new AbortController();

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

  onHide() {
    // Remove disconnect handler
    this.client?.removeDisconnectHandler(this.clientDisconnected);
  }
}
