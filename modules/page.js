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
  constructor(elementId) {
    this.el = document.getElementById(elementId);
  }

  show() {
    this.el.classList.remove("hidden");
    this.onShow();
  }

  hide() {
    this.el.classList.add("hidden");
    this.onHide();
  }

  onShow() {}
  onHide() {}
}
