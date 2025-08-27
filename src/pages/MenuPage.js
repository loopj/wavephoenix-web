import { connection } from '@/connection.js';
import { Page } from '@/Page.js';
import { semverToString, uint32ToSemver } from '@/utils.js';

export class MenuPage extends Page {
  #firmwareVersion = document.getElementById('menu-firmware-version');
  #settingsBtn = document.getElementById('menu-settings-btn');
  #firmwareBtn = document.getElementById('menu-firmware-btn');
  #exitBtn = document.getElementById('menu-exit-btn');

  constructor() {
    // Register the page
    super('menu-page');

    // Hook up event listeners
    this.#settingsBtn.addEventListener('click', this.settingsButtonClicked);
    this.#firmwareBtn.addEventListener('click', this.firmwareButtonClicked);
    this.#exitBtn.addEventListener('click', this.exitButtonClicked);
  }

  settingsButtonClicked = async () => {
    Page.show('settings');
  };

  firmwareButtonClicked = async () => {
    Page.show('firmware');
  };

  exitButtonClicked = async () => {
    // Tell the device to leave management mode
    if (connection.mode === 'management') {
      await connection.client.leaveSettings();
    } else {
      await connection.client.disconnect();
    }

    // Show the connect page
    Page.show('connect');
  };

  clientDisconnected() {
    Page.show('connect');
  }

  onShow() {
    // Register disconnect handler
    connection.client.addDisconnectHandler(this.clientDisconnected);

    this.#firmwareVersion.textContent = 'Current firmware version: x.x.x';

    // Show the current firmware version
    (async () => {
      if (connection.mode === 'legacy') {
        const version = await connection.client.getApplicationVersion();
        if (!version) {
          this.#firmwareVersion.textContent = 'No application firmware currently installed';
        } else {
          const semver = uint32ToSemver(version);
          this.#firmwareVersion.textContent = `Current firmware version: ${semverToString(semver)}`;
        }
      } else {
        const version = await connection.client.getVersion();
        this.#firmwareVersion.textContent = `Current firmware version: ${semverToString(version)}`;
      }
    })();

    // Hide settings button in legacy mode
    if (connection.mode === 'legacy') {
      this.#settingsBtn.classList.add('hidden');
    } else {
      this.#settingsBtn.classList.remove('hidden');
    }
  }

  onHide() {
    // Remove disconnect handler
    connection.client?.removeDisconnectHandler(this.clientDisconnected);
  }
}
