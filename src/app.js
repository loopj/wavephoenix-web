import { html } from 'htm/preact';
import { render } from 'preact';

import { ConnectPage } from './components/ConnectPage.js';
import { FirmwarePage } from './components/FirmwarePage.js';
import { MenuPage } from './components/MenuPage.js';
import { MigrationPage } from './components/MigrationPage.js';
import { SettingsPage } from './components/SettingsPage.js';

import { getCurrentPage } from './nav.js';

const PAGES = {
  connect: ConnectPage,
  firmware: FirmwarePage,
  menu: MenuPage,
  migration: MigrationPage,
  settings: SettingsPage,
};

function App() {
  const Page = PAGES[getCurrentPage()];
  if (Page) {
    return html`<${Page} />`;
  }

  return html`<div>Unknown page</div>`;
}

render(html`<${App} />`, document.getElementById('app'));
