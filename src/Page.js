export class Page {
  static #pages = {};

  static register(name, inst) {
    Page.#pages[name] = inst;
  }

  static show(name) {
    // Check if the page exists, put an error in the console if not
    if (!Page.#pages[name]) {
      console.error(`Page not found: ${name}`);
      return;
    }

    // Hide all pages
    Object.values(Page.#pages).forEach((page) => {
      page.hide();
    });

    // Show the requested page
    Page.#pages[name].show();
  }

  constructor(elementId) {
    this.el = document.getElementById(elementId);
  }

  show() {
    if (!this.el.classList.contains('hidden')) return;

    this.el.classList.remove('hidden');
    this.onShow();
  }

  hide() {
    if (this.el.classList.contains('hidden')) return;

    this.el.classList.add('hidden');
    this.onHide();
  }

  onShow() {}
  onHide() {}
}
