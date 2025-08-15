import { COMMANDS, FirmwareImage, Management, SETTINGS } from "./modules/management.js";

// Pages
const notSupportedPage = document.getElementById("not-supported-page");
const connectPage = document.getElementById("connect-page");
const menuPage = document.getElementById("menu-page");
const settingsPage = document.getElementById("settings-page");
const firmwarePage = document.getElementById("firmware-page");

// Common elements
const pageTitle = document.getElementById("page-title");
const statusText = document.getElementById("status-text");

// Connect page elements
const connectBtn = document.getElementById("connect-btn");

// Menu page elements
const menuSettings = document.getElementById("menu-settings-btn");
const menuFirmware = document.getElementById("menu-firmware-btn");
const exitBtn = document.getElementById("menu-exit-btn");

// Settings page elements
const writeBtn = document.getElementById("settings-save-btn");
const backFromSettings = document.getElementById("settings-back-btn");

// Firmware page elements
const firmwareFile = document.getElementById("firmware-file");
const firmwareSelectBtn = document.getElementById("firmware-choose-btn");
const firmwareChangeBtn = document.getElementById("firmware-change-btn");
const flashBtn = document.getElementById("firmware-flash-btn");
const progress = document.getElementById("progress");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");
const fileSelectionArea = document.getElementById("file-selection-area");
const fileSelectedArea = document.getElementById("file-selected-area");
const selectedFileName = document.getElementById("selected-file-name");
const backFromFirmware = document.getElementById("firmware-back-btn");

// Management client
let mgmt = null;

// Navigation functions
function showPage(page, title, titleColor) {
  [notSupportedPage, connectPage, menuPage, settingsPage, firmwarePage].forEach((p) => {
    p.classList.add("hidden");
  });
  page.classList.remove("hidden");
  pageTitle.textContent = title;
  pageTitle.style.color = titleColor;
}

// Web Bluetooth support check
if (!navigator.bluetooth) {
  showPage(notSupportedPage, "NOT SUPPORTED", "#f44336");
} else {
  showPage(connectPage, "NOT CONNECTED", "#ff9800");
}

// Navigation event listeners
menuSettings.addEventListener("click", () => {
  fetchSettings();
  showPage(settingsPage, "DEVICE SETTINGS", "#4caf50");
});

menuFirmware.addEventListener("click", () => {
  // Reset firmware update state
  firmwareFile.value = "";
  fileSelectionArea.classList.remove("hidden");
  fileSelectedArea.classList.add("hidden");
  flashBtn.classList.add("hidden");
  progress.style.display = "none";
  progressBar.style.width = "0%";
  progressText.textContent = "0%";

  // Show the page
  showPage(firmwarePage, "FIRMWARE UPDATE", "#4caf50");
});

backFromSettings.addEventListener("click", () => {
  showPage(menuPage, "WAVEPHOENIX CONNECTED", "#4caf50");
});

backFromFirmware.addEventListener("click", () => {
  // Cancel the upload
  if (mgmt && mgmt.isDFUActive()) mgmt.cancelDFU();

  showPage(menuPage, "WAVEPHOENIX CONNECTED", "#4caf50");
});

connectBtn.addEventListener("click", async () => {
  try {
    // Set up the management client
    mgmt = new Management();
    await mgmt.connect();
    mgmt.onDisconnect(onDisconnected);

    // TODO: Check for required service

    // Show the menu page once connected
    showPage(menuPage, "WAVEPHOENIX CONNECTED", "#4caf50");
  } catch (e) {
    if (e.name !== "NotFoundError") {
      console.error("Connection error:", e);
    }
  }
});

async function fetchSettings() {
  try {
    // Read all values
    const values = {};
    for (let code of [
      SETTINGS.WIRELESS_CHANNEL,
      SETTINGS.CONTROLLER_TYPE,
      SETTINGS.PIN_WIRELESS_ID,
      SETTINGS.PAIRING_BUTTONS,
    ]) {
      const val = await mgmt.getSetting(code);
      const bytes = Array.from(new Uint8Array(val.buffer));
      values[code] = bytes;
    }

    // Update UI with loaded values
    document.getElementById("val-0x00").value = values[SETTINGS.WIRELESS_CHANNEL][0] + 1;
    document.getElementById("val-0x01").value = values[SETTINGS.CONTROLLER_TYPE][0];
    document.getElementById("val-0x02").checked = values[SETTINGS.PIN_WIRELESS_ID][0] !== 0;

    // Pairing Buttons: Set checkboxes based on bitmask
    const pairingValue =
      values[SETTINGS.PAIRING_BUTTONS][0] | (values[SETTINGS.PAIRING_BUTTONS][1] << 8);
    document.querySelectorAll('#pairing-buttons input[type="checkbox"]').forEach((cb) => {
      const bit = parseInt(cb.dataset.bit);
      cb.checked = (pairingValue & (1 << bit)) !== 0;
    });
  } catch (error) {
    statusText.textContent = "Failed to load settings: " + error.message;
    console.error("Settings load error:", error);
  }
}

writeBtn.addEventListener("click", async () => {
  try {
    statusText.textContent = "Saving settings...";

    // Wireless Channel: Convert from 1-indexed to 0-indexed
    const channel = parseInt(document.getElementById("val-0x00").value) - 1;
    if (channel < 0 || channel > 15) {
      statusText.textContent = "Error: Wireless Channel must be between 1 and 16";
      setTimeout(() => {
        statusText.textContent = "";
      }, 3000);
      return;
    }
    await mgmt.writeSetting(SETTINGS.WIRELESS_CHANNEL, [channel]);

    // Controller Type
    const controllerType = parseInt(document.getElementById("val-0x01").value);
    await mgmt.writeSetting(SETTINGS.CONTROLLER_TYPE, [controllerType]);

    // Pin Wireless ID
    const pinWirelessId = document.getElementById("val-0x02").checked ? 1 : 0;
    await mgmt.writeSetting(SETTINGS.PIN_WIRELESS_ID, [pinWirelessId]);

    // Pairing Buttons: Convert checkboxes to bitmask
    let pairingValue = 0;
    document.querySelectorAll('#pairing-buttons input[type="checkbox"]').forEach((cb) => {
      if (cb.checked) {
        const bit = parseInt(cb.dataset.bit);
        pairingValue |= 1 << bit;
      }
    });
    const pairingBytes = [pairingValue & 0xff, (pairingValue >> 8) & 0xff];
    await mgmt.writeSetting(SETTINGS.PAIRING_BUTTONS, pairingBytes);

    statusText.textContent = "All settings saved successfully!";
    setTimeout(() => {
      statusText.textContent = "";
    }, 3000);
  } catch (error) {
    statusText.textContent = "Failed to save settings: " + error.message;
    console.error("Settings save error:", error);
  }
});

// DFU functionality
firmwareSelectBtn.addEventListener("click", () => {
  firmwareFile.click();
});

firmwareFile.addEventListener("change", function () {
  if (this.files.length > 0) {
    const file = this.files[0];
    const fileName = file.name;
    selectedFileName.textContent = `Selected: ${fileName}`;
    fileSelectionArea.classList.add("hidden");
    fileSelectedArea.classList.remove("hidden");

    // Read and validate header using FirmwareImage
    const reader = new FileReader();
    reader.onload = function (e) {
      const buffer = e.target.result;
      const firmwareImage = new FirmwareImage(buffer);
      if (!firmwareImage.checkMagicNumber()) {
        statusText.textContent = "Invalid firmware file: bad magic number.";
        flashBtn.classList.add("hidden");
        return;
      }
      const version = firmwareImage.getVersion();
      statusText.textContent = `Firmware version: ${version.major}.${version.minor}.${version.revision} (build ${version.buildNum})`;
      flashBtn.classList.remove("hidden");
    };
    reader.readAsArrayBuffer(file.slice(0, FirmwareImage.HEADER_SIZE));
  }
});

firmwareChangeBtn.addEventListener("click", () => {
  firmwareFile.click();
});

flashBtn.addEventListener("click", async () => {
  const file = firmwareFile.files[0];
  if (!file) {
    statusText.textContent = "Please select a firmware file first";
    setTimeout(() => {
      statusText.textContent = "";
    }, 3000);
    return;
  }

  // Read the firmware file as ArrayBuffer
  const arrayBuffer = await file.arrayBuffer();
  const firmwareImage = new FirmwareImage(arrayBuffer);

  // UI setup
  progress.style.display = "block";
  progressBar.style.width = "0%";
  progressText.textContent = "0%";
  flashBtn.classList.add("hidden");
  fileSelectedArea.classList.add("hidden");
  statusText.textContent = "Updating firmware...";

  try {
    await mgmt.startDFU(firmwareImage.data, (percent) => {
      progressBar.style.width = percent + "%";
      progressText.textContent = percent + "%";
    });
    progressText.textContent = "Complete!";
    statusText.textContent = "Firmware update completed successfully!";
  } catch (error) {
    progressText.textContent = "Failed";
    statusText.textContent = "Firmware update failed: " + error.message;
  } finally {
    flashBtn.classList.remove("hidden");
    fileSelectedArea.classList.remove("hidden");
    // Progress bar stays visible after DFU completes
    if (statusText.textContent.includes("successfully")) {
      statusText.textContent = "";
    }
  }
});

// Command functions
exitBtn.addEventListener("click", async () => {
  try {
    await mgmt.sendCommand(COMMANDS.LEAVE_SETTINGS);
    onDisconnected();
  } catch (err) {
    statusText.textContent = err.message;
  }
});

function onDisconnected() {
  showPage(connectPage, "WAVEPHOENIX DISCONNECTED", "#ff9800");

  // Reset all UI states
  connectBtn.classList.remove("hidden");

  flashBtn.classList.add("hidden");
  progress.style.display = "none";
  progressBar.style.width = "0%";
  progressText.textContent = "0%";
}
