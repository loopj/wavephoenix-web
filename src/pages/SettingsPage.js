import { connection } from '@/connection.js';
import { Page } from '@/Page.js';

export class SettingsPage extends Page {
  #backBtn = document.getElementById('settings-back-btn');

  #wirelessChannel = document.getElementById('settings-wireless-channel');
  #controllerType = document.getElementById('settings-controller-type');
  #pinWirelessId = document.getElementById('settings-pin-wireless-id');
  #pairingButtons = document.getElementById('settings-pairing-buttons');

  constructor() {
    // Register the page
    super('settings-page');

    // Hook up event listeners
    this.#backBtn.addEventListener('click', this.backButtonClicked);
    this.#wirelessChannel.addEventListener('change', this.wirelessChannelChanged);
    this.#controllerType.addEventListener('change', this.controllerTypeChanged);
    this.#pinWirelessId.addEventListener('change', this.wirelessIdChanged);
    this.#pairingButtons.addEventListener('change', this.pairingButtonsChanged);
  }

  wirelessChannelChanged = async () => {
    const channel = parseInt(this.#wirelessChannel.value, 10);
    await connection.client.setWirelessChannel(channel);
  };

  controllerTypeChanged = async () => {
    const type = parseInt(this.#controllerType.value, 10);
    await connection.client.setControllerType(type);
  };

  wirelessIdChanged = async () => {
    const isEnabled = this.#pinWirelessId.checked;
    await connection.client.setPinWirelessId(isEnabled);
  };

  pairingButtonsChanged = async () => {
    const bitfield = Array.from(this.#pairingButtons.selectedOptions)
      .map((option) => parseInt(option.value, 10))
      .reduce((acc, value) => acc | (1 << value), 0);

    await connection.client.setPairingButtons(bitfield);
  };

  backButtonClicked = () => {
    Page.show('menu');
  };

  clientDisconnected() {
    Page.show('connect');
  }

  async fetchSettings() {
    this.#wirelessChannel.value = await connection.client.getWirelessChannel();
    this.#controllerType.value = await connection.client.getControllerType();
    this.#pinWirelessId.checked = await connection.client.getPinWirelessId();

    const pairingButtons = await connection.client.getPairingButtons();
    for (let i = 0; i < this.#pairingButtons.options.length; i++) {
      const option = this.#pairingButtons.options[i];
      option.selected = (pairingButtons & (1 << i)) !== 0;
    }
  }

  onShow() {
    // Register disconnect handler
    connection.client.addDisconnectHandler(this.clientDisconnected);

    // Fetch settings in the background
    this.fetchSettings();
  }

  onHide() {
    // Remove disconnect handler
    connection.client?.removeDisconnectHandler(this.clientDisconnected);
  }
}
