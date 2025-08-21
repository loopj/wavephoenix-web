import { versionString } from "@/utils.js";

import { Page } from "./Page.js";

export class LegacyFirmwarePage extends Page {
  #fileInput = document.getElementById("legacy-firmware-file");
  #controller;

  // Selection
  #selectionArea = document.getElementById("legacy-firmware-selection-area");
  #selectionInfo = document.getElementById("legacy-firmware-selection-info");
  #chooseBtn = document.getElementById("legacy-firmware-choose-btn");

  // Selected
  #selectedArea = document.getElementById("legacy-firmware-selected-area");
  #flashBtn = document.getElementById("legacy-firmware-flash-btn");
  #backBtn = document.getElementById("legacy-firmware-back-btn");

  // Progress
  #progressArea = document.getElementById("legacy-firmware-progress-area");
  #progressInfo = document.getElementById("legacy-firmware-progress-info");
  #progressBarFill = document.querySelector("#legacy-firmware-progress-bar .progress-bar-fill");
  #progressBarText = document.querySelector("#legacy-firmware-progress-bar .progress-bar-text");
  #cancelBtn = document.getElementById("legacy-firmware-cancel-btn");
  #rebootBtn = document.getElementById("legacy-firmware-reboot-btn");

  constructor() {
    // Register the page
    super("legacy-firmware-page");

    // Hook up event listeners
    this.#fileInput.addEventListener("change", this.fileInputChanged);
    this.#chooseBtn.addEventListener("click", this.chooseButtonClicked);
    this.#flashBtn.addEventListener("click", this.flashButtonClicked);
    this.#backBtn.addEventListener("click", this.backButtonClicked);
    this.#cancelBtn.addEventListener("click", this.cancelButtonClicked);
    this.#rebootBtn.addEventListener("click", this.rebootButtonClicked);
  }

  fileInputChanged = () => {
    // Return early if no file is selected
    if (this.#fileInput.files.length === 0) {
      console.error("No firmware file selected");
      return;
    }

    this.#selectionArea.classList.add("hidden");
    this.#chooseBtn.classList.add("hidden");

    this.#selectedArea.classList.remove("hidden");
    this.#flashBtn.classList.remove("hidden");
    this.#backBtn.classList.remove("hidden");
  };

  chooseButtonClicked = () => {
    this.#fileInput.click();
  };

  flashButtonClicked = async () => {
    // Show progress area
    this.#progressArea.classList.remove("hidden");
    this.#selectedArea.classList.add("hidden");

    // Toggle button visibility
    this.#flashBtn.classList.add("hidden");
    this.#backBtn.classList.add("hidden");
    this.#cancelBtn.classList.remove("hidden");

    // Start the DFU process
    const file = this.#fileInput.files[0];
    try {
      await this.client.writeFirmware(await file.arrayBuffer(), {
        progress: this.setProgress,
        signal: this.#controller.signal,
      });
    } catch (e) {
      if (e.name === "AbortError") {
        this.onShow();
      } else {
        console.error("Error flashing firmware:", error);
        this.updateComplete(false);
      }
      return;
    }

    // Complete the update process
    this.updateComplete(true);
  };

  setProgress = (percent) => {
    this.#progressBarFill.style.width = `${percent}%`;
    this.#progressBarText.textContent = `${Math.round(percent)}%`;
  };

  updateComplete(success) {
    this.#cancelBtn.classList.add("hidden");

    if (success) {
      this.#progressInfo.textContent = "Firmware update complete!";
      this.#rebootBtn.classList.remove("hidden");
    } else {
      this.#progressInfo.textContent = "Firmware update failed.";
      this.#backBtn.classList.remove("hidden");
    }
  }

  rebootButtonClicked = () => {
    this.client.disconnect();
    Page.show("connect");
  };

  backButtonClicked = () => {
    this.onShow();
  };

  cancelButtonClicked = () => {
    this.#controller.abort();
  };

  onShow() {
    // Reset the file input and abort controller
    this.#fileInput.value = "";
    this.#controller = new AbortController();

    // Show only the file selection area
    this.#selectionArea.classList.remove("hidden");
    this.#selectedArea.classList.add("hidden");
    this.#progressArea.classList.add("hidden");

    // Reset text content
    this.#selectionInfo.textContent = `Current firmware version: x.x.x`;
    this.#progressInfo.textContent =
      "Firmware update in progress. Do not disconnect or power off your device until the update is complete.";

    // Fetch current firmware version
    (async () => {
      const version = await this.client.getVersion();
      if (version) {
        this.#selectionInfo.textContent = `Current firmware version: ${versionString(version)}`;
      } else {
        this.#selectionInfo.textContent = `No application firmware found.`;
      }
    })();

    // Reset progress bar
    this.setProgress(0);

    // Reset button states
    this.#chooseBtn.classList.remove("hidden");
    this.#backBtn.classList.add("hidden");
    this.#flashBtn.classList.add("hidden");
    this.#cancelBtn.classList.add("hidden");
    this.#rebootBtn.classList.add("hidden");
  }
}
