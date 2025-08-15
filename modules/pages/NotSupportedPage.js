import { Page } from "../page.js";

export class NotSupportedPage extends Page {
  constructor() {
    // Register the page
    super("not-supported-page", "NOT SUPPORTED", "#f44336");
  }
}
