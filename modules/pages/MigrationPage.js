import { Page } from "./Page.js";

export class MigrationPage extends Page {
  #backBtn = document.getElementById("migration-back-btn");

  constructor(sharedState) {
    // Register the page
    super("migration-page", sharedState);

    // Hook up event listeners
    this.#backBtn.addEventListener("click", this.backButtonClicked);
  }

  backButtonClicked = () => {
    if (this.client.connected) {
      showPage("menu");
    } else {
      showPage("connect");
    }
  };

  onShow() {
    // Reset button states
    this.#backBtn.classList.remove("hidden");
  }
}
