import { SETTINGS } from "../Client.js";
import { Page, showPage } from "../page.js";

export class SettingsPage extends Page {
  #backBtn = document.getElementById("settings-back-btn");

  #wirelessChannel = document.getElementById("settings-wireless-channel");
  #controllerType = document.getElementById("settings-controller-type");
  #pinWirelessId = document.getElementById("settings-pin-wireless-id");
  #pairingButtons = document.getElementById("settings-pairing-buttons");

  constructor(client) {
    // Register the page
    super("settings-page");

    // Store the management client
    this.client = client;

    // Hook up event listeners
    this.#backBtn?.addEventListener("click", this.backButtonClicked);
    this.#wirelessChannel?.addEventListener("change", this.wirelessChannelChanged);
    this.#controllerType?.addEventListener("change", this.controllerTypeChanged);
    this.#pinWirelessId?.addEventListener("change", this.wirelessIdChanged);
    this.#pairingButtons?.addEventListener("change", this.pairingButtonsChanged);
  }

  wirelessChannelChanged = async () => {
    const channel = parseInt(this.#wirelessChannel.value, 10);
    try {
      await this.client.writeSetting(SETTINGS.WIRELESS_CHANNEL, [channel]);
    } catch (err) {
      console.error("Failed to update wireless channel setting:", err);
    }
  };

  controllerTypeChanged = async () => {
    const type = parseInt(this.#controllerType.value, 10);
    try {
      await this.client.writeSetting(SETTINGS.CONTROLLER_TYPE, [type]);
    } catch (err) {
      console.error("Failed to update controller type setting:", err);
    }
  };

  wirelessIdChanged = async () => {
    const isEnabled = this.#pinWirelessId?.checked;
    try {
      // Update the setting on the device
      await this.client.writeSetting(SETTINGS.PIN_WIRELESS_ID, [isEnabled]);
    } catch (err) {
      console.error("Failed to update wireless ID pinning setting:", err);
    }
  };

  pairingButtonsChanged = async () => {
    console.log("TODO: Pairing buttons changed");
  };

  backButtonClicked = () => {
    showPage("menu");
  };

  async fetchSettings() {
    const wirelessChannelBytes = await this.client.readSetting(SETTINGS.WIRELESS_CHANNEL);
    const wirelessChannel = wirelessChannelBytes.getUint8(0);
    this.#wirelessChannel.value = wirelessChannel;

    const controllerTypeBytes = await this.client.readSetting(SETTINGS.CONTROLLER_TYPE);
    const controllerType = controllerTypeBytes.getUint8(0);
    this.#controllerType.value = controllerType;

    const pinWirelessIdBytes = await this.client.readSetting(SETTINGS.PIN_WIRELESS_ID);
    const pinWirelessId = pinWirelessIdBytes.getUint8(0) === 1;
    this.#pinWirelessId.checked = pinWirelessId;

    const pairingButtonsBytes = await this.client.readSetting(SETTINGS.PAIRING_BUTTONS);
    const pairingButtons = pairingButtonsBytes.getUint16(0, true);
    for (let i = 0; i < this.#pairingButtons.options.length; i++) {
      const option = this.#pairingButtons.options[i];
      option.selected = (pairingButtons & (1 << i)) !== 0;
    }
  }

  onShow() {
    // Fetch settings in the background
    this.fetchSettings();
  }
}
