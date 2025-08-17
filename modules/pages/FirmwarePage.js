import { FirmwareImage } from "../management.js";
import { Page, showPage } from "../page.js";

export class FirmwarePage extends Page {
  #page = document.getElementById("firmware-page");

  // Button bar
  #backBtn = document.getElementById("firmware-back-btn");
  #flashBtn = document.getElementById("firmware-flash-btn");
  #cancelBtn = document.getElementById("firmware-cancel-btn");

  // File selection
  #fileSelectionArea = document.getElementById("firmware-file-selection-area");
  #fileSelectionInfo = document.getElementById("firmware-file-selection-info");
  #fileInput = document.getElementById("firmware-file");
  #chooseBtn = document.getElementById("firmware-choose-btn");

  // File selected area
  #fileSelectedArea = document.getElementById("firmware-file-selected-area");
  #fileSelectedInfo = document.getElementById("firmware-file-selected-info");
  #changeBtn = document.getElementById("firmware-change-btn");

  // Upload progress
  #progressArea = document.getElementById("firmware-progress-area");
  #progressBarFill = document.querySelector("#firmware-progress-bar .progress-bar-fill");
  #progressBarText = document.querySelector("#firmware-progress-bar .progress-bar-text");

  constructor(client) {
    // Register the page
    super("firmware-page");

    // Store the management client
    this.client = client;

    // Hook up event listeners
    this.#backBtn?.addEventListener("click", this.backButtonClicked);
    this.#flashBtn?.addEventListener("click", this.flashButtonClicked);
    this.#cancelBtn?.addEventListener("click", this.cancelButtonClicked);
    this.#fileInput?.addEventListener("change", this.fileInputChanged);
    this.#chooseBtn?.addEventListener("click", this.chooseButtonClicked);
    this.#changeBtn?.addEventListener("click", this.changeButtonClicked);
    this.#page?.addEventListener("dragenter", this.pageDragEnter);
    this.#page?.addEventListener("dragover", (e) => e.preventDefault());
    this.#page?.addEventListener("dragleave", this.pageDragLeave);
    this.#page?.addEventListener("drop", this.pageDropped);
  }

  chooseButtonClicked = () => {
    this.#fileInput.click();
  };

  changeButtonClicked = () => {
    this.#fileInput.click();
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
    const firmwareImage = new FirmwareImage(await file.arrayBuffer());

    try {
      await this.client.startDFU(firmwareImage, (percent) => {
        this.#progressBarFill.style.width = percent + "%";
        this.#progressBarText.textContent = percent + "%";
      });
    } catch (error) {
      console.error("DFU process failed:", error);
    }

    // TODO: Think about if we should show reboot, sha256 check, etc?
  };

  backButtonClicked = () => {
    showPage("menu");
  };

  cancelButtonClicked = () => {
    this.client.cancelDFU();
    this.onShow();
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
    const firmwareImage = new FirmwareImage(await file.arrayBuffer());

    // Check if the firmware image is valid
    if (!firmwareImage.checkMagicNumber()) {
      // Show the error
      this.#fileSelectionInfo.textContent = `Invalid WavePhoenix firmware selected.`;
    } else {
      // Show the selected firmware information
      const version = firmwareImage.getVersionString();
      this.#fileSelectedInfo.textContent = `WavePhoenix firmware found, version ${version}`;

      // Toggle the "firmware selected" area
      this.#fileSelectionArea.classList.add("hidden");
      this.#fileSelectedArea.classList.remove("hidden");

      // Show the flash button
      this.#flashBtn.classList.remove("hidden");
    }
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

  onShow() {
    // Reset the file input
    this.#fileInput.value = "";

    // Show only the file selection area
    this.#fileSelectionArea.classList.remove("hidden");
    this.#fileSelectionInfo.textContent = "Select or drag a firmware file to update your device.";
    this.#fileSelectedArea.classList.add("hidden");
    this.#progressArea.classList.add("hidden");

    // Reset progress bar
    this.#progressBarFill.style.width = "0%";
    this.#progressBarText.textContent = "0%";

    // Reset button states
    this.#backBtn.classList.remove("hidden");
    this.#flashBtn.classList.add("hidden");
    this.#cancelBtn.classList.add("hidden");
  }
}
