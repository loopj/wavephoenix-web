import { TimeoutError } from "../management.js";
import { Page, showPage } from "../page.js";

export class ConnectPage extends Page {
  #connectBtn = document.getElementById("connect-btn");
  #connectError = document.getElementById("connect-error");

  constructor(client) {
    // Register the page
    super("connect-page");

    // Save the management client
    this.client = client;

    // Hook up event listeners
    this.#connectBtn?.addEventListener("click", this.connectButtonClicked);
  }

  connectButtonClicked = async () => {
    // Show loading state
    this.#connectBtn.classList.add("loading");
    this.#connectBtn.disabled = true;

    try {
      // Attempt to connect the client
      await this.client.connect();

      // Show the main menu if connected successfully
      showPage("menu");
    } catch (e) {
      // Handle error
      if (e.name === "NotFoundError") {
        console.debug("User cancelled Bluetooth device selection");
      } else if (e instanceof TimeoutError) {
        this.#connectError.textContent = "Connection timed out. Please try again.";
        this.#connectError.classList.remove("hidden");
      } else {
        this.#connectError.textContent = "Bluetooth connection failed. Please try again.";
        this.#connectError.classList.remove("hidden");

        console.error("Bluetooth connection failed", e);
      }
    }

    // Hide loading state
    this.#connectBtn.classList.remove("loading");
    this.#connectBtn.disabled = false;
  };

  onShow = () => {
    this.#connectError.classList.add("hidden");
  };
}
