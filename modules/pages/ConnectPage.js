import { GECKO_BOOTLOADER_SERVICE_UUID } from "../GeckoBootloaderClient.js";
import { MANAGEMENT_SERVICE_UUID, ManagementClient, TimeoutError } from "../ManagementClient.js";
import { MIGRATION_SERVICE_UUID } from "../MigrationClient.js";
import { Page, showPage } from "./Page.js";

export class ConnectPage extends Page {
  #connectBtn = document.getElementById("connect-btn");
  #connectError = document.getElementById("connect-error");

  constructor(sharedState) {
    // Register the page
    super("connect-page", sharedState);

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
          MANAGEMENT_SERVICE_UUID,
          MIGRATION_SERVICE_UUID,
          GECKO_BOOTLOADER_SERVICE_UUID,
        ],
      });

      // Connect to discover services
      await device.gatt.connect();

      // Determine if we are in legacy mode, migration mode, or management mode
      const serviceUUID = (await device.gatt.getPrimaryServices()).map((s) => s.uuid)[0];
      switch (serviceUUID) {
        case MANAGEMENT_SERVICE_UUID:
          // Set up a management client
          this.client = new ManagementClient(device);
          this.client.setDisconnectCallback(() => {
            showPage("connect");
          });

          // Connect to the management client
          await this.client.connect();

          // Show the management menu
          showPage("menu");
          break;
        case MIGRATION_SERVICE_UUID:
          console.log("Connected to Migration Service");
          break;
        case GECKO_BOOTLOADER_SERVICE_UUID:
          console.log("Connected to Gecko Bootloader Service");
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
