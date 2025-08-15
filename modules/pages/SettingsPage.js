import { Page, showPage } from "../page.js";

export class SettingsPage extends Page {
  #backBtn = document.getElementById("settings-back-btn");

  constructor(client) {
    // Register the page
    super("settings-page", "DEVICE SETTINGS", "#4caf50");

    // Store the management client
    this.client = client;

    // Hook up event listeners
    this.#backBtn?.addEventListener("click", this.backButtonClicked);
  }

  backButtonClicked = async () => {
    showPage("menu");
  };
}
