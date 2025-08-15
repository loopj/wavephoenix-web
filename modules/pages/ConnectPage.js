import { Page, showPage } from "../page.js";

export class ConnectPage extends Page {
  #connectBtn = document.getElementById("connect-btn");

  constructor(client) {
    // Register the page
    super("connect-page", "NOT CONNECTED", "#ff9800");

    // Save the management client
    this.client = client;

    // Hook up event listeners
    this.#connectBtn?.addEventListener("click", this.connectButtonClicked);
  }

  connectButtonClicked = async () => {
    try {
      // Show loading state
      this.#connectBtn.classList.add("btn-loading");
      this.#connectBtn.disabled = true;

      // Attempt to connect the client
      await this.client.connect();

      // Show the main menu if connected successfully
      showPage("menu");
    } catch (e) {
      // Handle error
      if (e.name === "NotFoundError") {
        console.debug("User cancelled Bluetooth device selection");
      } else {
        console.error("Bluetooth connection failed");
      }
    } finally {
      // Hide loading state
      this.#connectBtn.classList.remove("btn-loading");
      this.#connectBtn.disabled = false;
    }
  };
}
