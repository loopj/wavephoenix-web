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
    (async () => {
      if (this.mode === "legacy") {
        const version = await this.client.getApplicationVersionSemantic();
        if (!version.major && !version.minor && !version.patch && !version.build) {
          this.#firmwareVersion.textContent = "No application firmware currently installed.";
        } else {
          this.#firmwareVersion.textContent = `Current firmware version: ${versionString(version)}.`;
        }
      } else {
        const version = await this.client.getVersion();
        this.#firmwareVersion.textContent = `Current firmware version: ${versionString(version)}.`;
      }
    })();

    // Hide settings button in legacy mode
    if (this.mode === "legacy") {
      this.#settingsBtn.classList.add("hidden");
    } else {
      this.#settingsBtn.classList.remove("hidden");
    }
  }

  onHide() {
    // Remove disconnect handler
    this.client?.removeDisconnectHandler(this.clientDisconnected);
  }
}
