import { connectToDevice } from "@/DeviceManager.js";

import { Page } from "./Page.js";

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
      // Connect to the device
      const { client, mode } = await connectToDevice();

      // Save the client and device mode
      this.client = client;
      this.mode = mode;

      // Change to the appropriate page
      if (mode === "management") {
        Page.show("menu");
      } else if (mode === "migration") {
        Page.show("migration");
      } else if (mode === "legacy") {
        Page.show("legacy-firmware");
      }
    } catch (e) {
      if (e.name === "NotFoundError") {
        console.debug("User cancelled Bluetooth device selection");
      } else if (e.code === "ETIMEDOUT") {
        this.#connectInfo.textContent = "Connection timed out. Please try again.";
      } else {
        this.#connectInfo.textContent = "Bluetooth connection failed. Please try again.";
        console.error("Bluetooth connection failed", e);
      }
    }

    // Hide loading state
    this.#connectBtn.classList.remove("loading");
    this.#connectBtn.disabled = false;
  };
}
