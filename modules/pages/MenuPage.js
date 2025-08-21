import { versionString } from "@/utils.js";

import { Page } from "./Page.js";

export class MenuPage extends Page {
  #firmwareVersion = document.getElementById("menu-firmware-version");
  #settingsBtn = document.getElementById("menu-settings-btn");
  #firmwareBtn = document.getElementById("menu-firmware-btn");
  #exitBtn = document.getElementById("menu-exit-btn");

  constructor() {
    // Register the page
    super("menu-page");

    // Hook up event listeners
    this.#settingsBtn.addEventListener("click", this.settingsButtonClicked);
    this.#firmwareBtn.addEventListener("click", this.firmwareButtonClicked);
    this.#exitBtn.addEventListener("click", this.exitButtonClicked);
  }

  settingsButtonClicked = async () => {
    Page.show("settings");
  };

  firmwareButtonClicked = async () => {
    Page.show("firmware");
  };

  exitButtonClicked = async () => {
    // Tell the device to leave management mode
    await this.client.leaveSettings();

    // Show the connect page
    Page.show("connect");
  };

  clientDisconnected() {
    Page.show("connect");
  }

  onShow() {
    // Register disconnect handler
    this.client.addDisconnectHandler(this.clientDisconnected);

    // Show the current firmware version
    this.#firmwareVersion.textContent = `Current firmware version: ${versionString(this.client.getVersion())}`;
  }

  onHide() {
    // Remove disconnect handler
    this.client?.removeDisconnectHandler(this.clientDisconnected);
  }
}
