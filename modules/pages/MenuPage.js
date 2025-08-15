import { COMMANDS } from "../management.js";
import { Page, showPage } from "../page.js";

export class MenuPage extends Page {
  #settingsBtn = document.getElementById("menu-settings-btn");
  #firmwareBtn = document.getElementById("menu-firmware-btn");
  #exitBtn = document.getElementById("menu-exit-btn");

  constructor(client) {
    // Register the page
    super("menu-page", "WAVEPHOENIX CONNECTED", "#4caf50");

    // Store the management client
    this.client = client;

    // Hook up event listeners
    this.#settingsBtn?.addEventListener("click", this.settingsButtonClicked);
    this.#firmwareBtn?.addEventListener("click", this.firmwareButtonClicked);
    this.#exitBtn?.addEventListener("click", this.exitButtonClicked);
  }

  settingsButtonClicked = async () => {
    showPage("settings");
  };

  firmwareButtonClicked = async () => {
    showPage("firmware");
  };

  exitButtonClicked = async () => {
    try {
      // Tell the device to leave management mode
      await this.client.sendCommand(COMMANDS.LEAVE_SETTINGS);

      // Show the connect page
      showPage("connect");
    } catch (err) {
      // Exiting management mode on the device immediately disables
      // Bluetooth, so let's ignore GATT errors
      console.debug("Error during exit:", err);
    }
  };
}
