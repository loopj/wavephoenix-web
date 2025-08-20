import { Page } from "./Page.js";

export class MigrationPage extends Page {
  #backBtn = document.getElementById("migration-back-btn");

  constructor() {
    // Register the page
    super("migration-page");

    // Hook up event listeners
    this.#backBtn.addEventListener("click", this.backButtonClicked);
  }

  backButtonClicked = () => {};

  onShow() {
    // Reset button states
    this.#backBtn.classList.remove("hidden");
  }
}
