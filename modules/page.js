const pages = {};

export function registerPage(name, inst) {
  pages[name] = inst;
}

export function showPage(name) {
  // Check if the page exists, put an error in the console if not
  if (!pages[name]) {
    console.error(`Page not found: ${name}`);
    return;
  }

  // Hide all pages
  Object.values(pages).forEach((page) => page.hide());

  // Show the requested page
  if (pages[name]) pages[name].show();
}

export class Page {
  #pageTitle = document.getElementById("page-title");
  #statusText = document.getElementById("status-text");

  constructor(elementId, title, titleColor) {
    this.title = title;
    this.titleColor = titleColor;
    this.el = document.getElementById(elementId);
  }

  show() {
    this.el.classList.remove("hidden");
    if (this.#pageTitle) {
      this.#pageTitle.textContent = this.title;
      this.#pageTitle.style.color = this.titleColor;
    }

    this.onShow();
  }

  hide() {
    this.el.classList.add("hidden");
    this.clearStatus();
    this.onHide();
  }

  setStatus(text) {
    this.#statusText.textContent = text;
  }

  clearStatus() {
    this.#statusText.textContent = "";
  }

  onShow() {}
  onHide() {}
}
