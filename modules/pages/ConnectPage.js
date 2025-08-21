import { GeckoBootloaderClient } from "@/clients/GeckoBootloaderClient.js";
import { ManagementClient } from "@/clients/ManagementClient.js";
import { MigrationClient } from "@/clients/MigrationClient.js";

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
      // Prompt user to select a device
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: "WavePhoenix" }],
        optionalServices: [
          ManagementClient.SERVICE_UUID,
          MigrationClient.SERVICE_UUID,
          GeckoBootloaderClient.SERVICE_UUID,
        ],
      });

      // Connect to discover services
      await device.gatt.connect();

      // Determine if we are in legacy mode, migration mode, or management mode
      const serviceUUID = (await device.gatt.getPrimaryServices()).map((s) => s.uuid)[0];
      switch (serviceUUID) {
        case ManagementClient.SERVICE_UUID:
          // Set up a management client
          this.client = new ManagementClient(device);
          this.client.setDisconnectCallback(() => {
            Page.show("connect");
          });

          // Connect to the management client
          await this.client.connect();

          // Show the management menu
          Page.show("menu");
          break;
        case MigrationClient.SERVICE_UUID:
          // Set up a migration client
          this.client = new MigrationClient(device);
          await this.client.connect();

          // Show the migration page
          Page.show("migration");
          break;
        case GeckoBootloaderClient.SERVICE_UUID:
          // Set up a Gecko bootloader client
          this.client = new GeckoBootloaderClient(device);
          await this.client.connect();

          // Show the legacy firmware page
          Page.show("legacy-firmware");
          break;
        default:
          console.error("Unknown service UUID:", serviceUUID);
          device.gatt.disconnect();
          break;
      }
    } catch (e) {
      // Handle error
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
