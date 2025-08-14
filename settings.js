// Service and characteristic definitions
import {
  COMMANDS,
  FirmwareImage,
  Management,
  SETTINGS,
} from "./modules/management.js";

// DOM elements
const connectionStatus = document.getElementById("connection-status");
const statusText = document.getElementById("status-text");
const connectBtn = document.getElementById("connect-btn");
const loading = document.getElementById("loading");

// Navigation elements
const mainMenu = document.getElementById("main-menu");
const settingsPage = document.getElementById("settings-page");
const firmwarePage = document.getElementById("firmware-page");

// Menu buttons
const menuSettings = document.getElementById("menu-settings");
const menuFirmware = document.getElementById("menu-firmware");
const backFromSettings = document.getElementById("back-from-settings");
const backFromFirmware = document.getElementById("back-from-firmware");

// Settings elements
const writeBtn = document.getElementById("write-btn");

// Firmware elements
const firmwareFile = document.getElementById("firmware-file");
const flashBtn = document.getElementById("flash-btn");
const progress = document.getElementById("progress");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");
const fileSelectionArea = document.getElementById("file-selection-area");
const fileSelectedArea = document.getElementById("file-selected-area");
const selectedFileName = document.getElementById("selected-file-name");
const changeFileBtn = document.getElementById("change-file-btn");

// Command elements
const exitBtn = document.getElementById("exit-btn");

let dfuInProgress = false;
let mgmt = null;

// Welcome message function
function showWelcomeMessage() {
  statusText.innerHTML = `
                Welcome to WavePhoenix Web!<br><br>
                Hold the pair button on your WavePhoenix for 3 seconds to enter management mode.<br><br>
                The LED will begin breathing to indicate management mode is active. Then click Connect to Device below.
            `;
}

// Navigation functions
function showMainMenu() {
  mainMenu.classList.remove("hidden");
  settingsPage.classList.add("hidden");
  firmwarePage.classList.add("hidden");
  connectionStatus.textContent = "CONNECTED TO WAVEPHOENIX";
  statusText.textContent = "";
}

function showSettingsPage() {
  mainMenu.classList.add("hidden");
  settingsPage.classList.remove("hidden");
  firmwarePage.classList.add("hidden");
  connectionStatus.textContent = "DEVICE SETTINGS";
  statusText.textContent = "";
}

function showFirmwarePage() {
  mainMenu.classList.add("hidden");
  settingsPage.classList.add("hidden");
  firmwarePage.classList.remove("hidden");
  connectionStatus.textContent = "FIRMWARE UPDATE";
  statusText.textContent = "";

  // Reset firmware update state
  firmwareFile.value = "";
  fileSelectionArea.classList.remove("hidden");
  fileSelectedArea.classList.add("hidden");
  flashBtn.classList.add("hidden");
  progress.style.display = "none";
  progressBar.style.width = "0%";
  progressText.textContent = "0%";
}

// Web Bluetooth support check
if (!navigator.bluetooth) {
  connectionStatus.textContent = "NOT SUPPORTED";
  connectionStatus.style.color = "#f44336";
  statusText.innerHTML = `
        Your browser does not support Web Bluetooth.<br><br>
        Please try using <b>Google Chrome</b> or a compatible browser.
      `;
  connectBtn.style.display = "none";
} else {
  // Show welcome message on page load
  showWelcomeMessage();
}

// Navigation event listeners
menuSettings.addEventListener("click", () => {
  showSettingsPage();
  // Auto-load settings when entering settings page
  refreshAll();
});

menuFirmware.addEventListener("click", () => {
  showFirmwarePage();
});

backFromSettings.addEventListener("click", () => {
  showMainMenu();
});

backFromFirmware.addEventListener("click", () => {
  if (mgmt && mgmt.isDFUActive()) {
    // Cancel the upload and return to menu
    mgmt.cancelDFU();
    progress.style.display = "none";
    flashBtn.classList.remove("hidden");
    fileSelectedArea.classList.remove("hidden");
    progressBar.style.width = "0%";
    progressText.textContent = "0%";
    statusText.textContent = "Firmware update cancelled.";
    setTimeout(() => {
      statusText.textContent = "";
    }, 2000);
    showMainMenu();
  } else {
    showMainMenu();
  }
});

connectBtn.addEventListener("click", async () => {
  try {
    statusText.textContent = "Connecting to device...";
    mgmt = new Management();
    await mgmt.connect();
    mgmt.onDisconnect(onDisconnected);
    connectionStatus.textContent = "CONNECTED TO WAVEPHOENIX";
    connectionStatus.style.color = "#4caf50";
    connectBtn.classList.add("hidden");
    loading.classList.remove("hidden");
    statusText.textContent = "Loading device connection...";
    loading.classList.add("hidden");
    showMainMenu();
  } catch (e) {
    if (e.name !== "NotFoundError") {
      statusText.textContent = "Connection failed: " + e.message;
    }
    console.error("Connection error:", e);
  }
});

async function refreshAll() {
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
    document.getElementById("val-0x00").value =
      values[SETTINGS.WIRELESS_CHANNEL][0] + 1;
    document.getElementById("val-0x01").value =
      values[SETTINGS.CONTROLLER_TYPE][0];
    document.getElementById("val-0x02").checked =
      values[SETTINGS.PIN_WIRELESS_ID][0] !== 0;

    // Pairing Buttons: Set checkboxes based on bitmask
    const pairingValue =
      values[SETTINGS.PAIRING_BUTTONS][0] |
      (values[SETTINGS.PAIRING_BUTTONS][1] << 8);
    document
      .querySelectorAll('#pairing-buttons input[type="checkbox"]')
      .forEach((cb) => {
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
      statusText.textContent =
        "Error: Wireless Channel must be between 1 and 16";
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
    document
      .querySelectorAll('#pairing-buttons input[type="checkbox"]')
      .forEach((cb) => {
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
  } else {
    fileSelectionArea.classList.remove("hidden");
    fileSelectedArea.classList.add("hidden");
    flashBtn.classList.add("hidden");
  }
});

changeFileBtn.addEventListener("click", () => {
  firmwareFile.value = "";
  fileSelectionArea.classList.remove("hidden");
  fileSelectedArea.classList.add("hidden");
  flashBtn.classList.add("hidden");
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
  // ...existing code...
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
    setTimeout(() => {
      statusText.textContent = "";
    }, 3000);
  }
});

function onDisconnected() {
  console.log("Device disconnected");

  characteristic = null;
  commandCharacteristic = null;
  firmwareDataCharacteristic = null;
  device = null;

  connectionStatus.textContent = "WAVEPHOENIX DISCONNECTED";
  connectionStatus.style.color = "#ff9800";

  // Show the standard welcome message
  showWelcomeMessage(); // Reset all UI states
  connectBtn.classList.remove("hidden");
  loading.classList.add("hidden");
  mainMenu.classList.add("hidden");
  settingsPage.classList.add("hidden");
  firmwarePage.classList.add("hidden");
  flashBtn.classList.add("hidden");
  progress.style.display = "none";
  progressBar.style.width = "0%";
  progressText.textContent = "0%";

  // Reset firmware file selection
  firmwareFile.value = "";
  fileSelectionArea.classList.remove("hidden");
  fileSelectedArea.classList.add("hidden");
  dfuInProgress = false;
}
