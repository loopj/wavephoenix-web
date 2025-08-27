import { connect } from "@/connection.js";
import { Page } from "@/Page.js";

export class ConnectPage extends Page {
  #connectBtn = document.getElementById("connect-btn");
  #connectInfo = document.getElementById("connect-info");

  constructor() {
    // Register the page
    super("connect-page");

    // Hook up event listeners
    this.#connectBtn.addEventListener("click", this.connectButtonClicked);
  }

  connectButtonClicked = async () => {
    // Show loading state
    this.#connectBtn.classList.add("loading");
    this.#connectBtn.disabled = true;

    try {
      // Connect to the device and change to the appropriate page
      const connection = await connect();
      if (connection.mode === "management") {
        Page.show("menu");
      } else if (connection.mode === "migration") {
        Page.show("migration");
      } else if (connection.mode === "legacy") {
        Page.show("menu");
      }
    } catch (e) {
      if (e.code === "ECANCELED") {
        // Ignore user cancellation
      } else if (e.code === "ETIMEDOUT") {
        this.#connectInfo.textContent =
          "Connection timed out. Please try again.";
      } else {
        this.#connectInfo.textContent =
          "Bluetooth connection failed. Please try again.";
        console.error("Bluetooth connection failed", e);
      }
    }

    // Hide loading state
    this.#connectBtn.classList.remove("loading");
    this.#connectBtn.disabled = false;
  };
}
