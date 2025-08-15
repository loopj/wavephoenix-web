import { FirmwareImage } from "../management.js";
import { Page, showPage } from "../page.js";

export class FirmwarePage extends Page {
  // Button bar
  #backBtn = document.getElementById("firmware-back-btn");
  #flashBtn = document.getElementById("firmware-flash-btn");

  // File selection
  #fileSelectionArea = document.getElementById("firmware-file-selection-area");
  #fileInput = document.getElementById("firmware-file");
  #chooseBtn = document.getElementById("firmware-choose-btn");

  // File selected area
  #fileSelectedArea = document.getElementById("firmware-file-selected-area");
  #changeBtn = document.getElementById("firmware-change-btn");

  // Upload progress
  #progressArea = document.getElementById("firmware-progress-area");
  #progressBar = document.getElementById("firmware-progress-bar");
  #progressText = document.getElementById("firmware-progress-text");

  constructor(client) {
    // Register the page
    super("firmware-page", "FIRMWARE UPDATE", "#4caf50");

    // Store the management client
    this.client = client;

    // Hook up event listeners
    this.#backBtn?.addEventListener("click", this.backButtonClicked);
    this.#flashBtn?.addEventListener("click", this.flashButtonClicked);
    this.#fileInput?.addEventListener("change", this.fileInputChanged);
    this.#chooseBtn?.addEventListener("click", this.chooseButtonClicked);
    this.#changeBtn?.addEventListener("click", this.changeButtonClicked);
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

    // Hide flash button
    this.#flashBtn.classList.add("hidden");

    // Start the DFU process
    const file = this.#fileInput.files[0];
    const firmwareImage = new FirmwareImage(await file.arrayBuffer());

    try {
      await this.client.startDFU(firmwareImage, (percent) => {
        this.#progressBar.style.width = percent + "%";
        this.#progressText.textContent = percent + "%";
      });
    } catch (error) {
      console.error("DFU process failed:", error);
    }

    // TODO: Think about if we should show reboot, sha256 check, etc?
    this.setStatus("Firmware update completed successfully!");
  };

  backButtonClicked = () => {
    this.client.cancelDFU();

    showPage("menu");
  };

  fileInputChanged = async (event) => {
    // Return early if no file is selected
    if (this.#fileInput.files.length === 0) {
      console.error("No firmware file selected");
      return;
    }

    // Parse the firmware image
    const file = this.#fileInput.files[0];
    const firmwareImage = new FirmwareImage(await file.arrayBuffer());

    // Check if the firmware image is valid
    if (!firmwareImage.checkMagicNumber()) {
      this.setStatus("Invalid firmware file selected!");
      console.info("Invalid firmware file: bad magic number");
    } else {
      // Show the selected firmware information
      this.setStatus(`Selected ${file.name}, version ${firmwareImage.getVersionString()}`);

      // Toggle the "firmware selected" area
      this.#fileSelectionArea.classList.add("hidden");
      this.#fileSelectedArea.classList.remove("hidden");

      // Show the flash button
      this.#flashBtn.classList.remove("hidden");
    }
  };

  onShow() {
    // Reset the file input
    this.#fileInput.value = "";

    // Show only the file selection area
    this.#fileSelectionArea.classList.remove("hidden");
    this.#fileSelectedArea.classList.add("hidden");
    this.#progressArea.classList.add("hidden");

    // Reset progress bar
    this.#progressBar.style.width = "0%";
    this.#progressText.textContent = "0%";

    // Hide the flash button
    this.#flashBtn.classList.add("hidden");

    // Clear any previous status messages
    this.clearStatus();
  }
}
