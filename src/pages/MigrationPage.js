import { connection } from '@/connection.js';
import { Page } from '@/Page.js';

export class MigrationPage extends Page {
  #backBtn = document.getElementById('migration-back-btn');

  constructor() {
    // Register the page
    super('migration-page');

    // Hook up event listeners
    this.#backBtn.addEventListener('click', this.backButtonClicked);
  }

  backButtonClicked = () => {
    connection.client.disconnect();
  };

  clientDisconnected() {
    Page.show('connect');
  }

  onShow() {
    // Register disconnect handler
    connection.client.addDisconnectHandler(this.clientDisconnected);

    // Reset button states
    this.#backBtn.classList.remove('hidden');
  }

  onHide() {
    // Remove disconnect handler
    connection.client?.removeDisconnectHandler(this.clientDisconnected);
  }
}
