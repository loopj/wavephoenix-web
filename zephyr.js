import { ConnectPage } from "./modules/pages/ConnectPage.js";
import { FirmwarePage } from "./modules/pages/FirmwarePage.js";
import { MenuPage } from "./modules/pages/MenuPage.js";
import { MigrationPage } from "./modules/pages/MigrationPage.js";
import { NotSupportedPage } from "./modules/pages/NotSupportedPage.js";
import { registerPage, showPage } from "./modules/pages/Page.js";
import { SettingsPage } from "./modules/pages/SettingsPage.js";

// Shared page state
const sharedState = {};

// Create the pages
registerPage("not-supported", new NotSupportedPage(sharedState));
registerPage("connect", new ConnectPage(sharedState));
registerPage("menu", new MenuPage(sharedState));
registerPage("settings", new SettingsPage(sharedState));
registerPage("firmware", new FirmwarePage(sharedState));
registerPage("migration", new MigrationPage(sharedState));

// Check if the browser supports Web Bluetooth
if (!navigator.bluetooth) {
  showPage("not-supported");
} else {
  showPage("connect");
}
