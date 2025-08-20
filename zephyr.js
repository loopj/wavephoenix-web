import { ConnectPage } from "./modules/pages/ConnectPage.js";
import { FirmwarePage } from "./modules/pages/FirmwarePage.js";
import { LegacyFirmwarePage } from "./modules/pages/LegacyFirmwarePage.js";
import { MenuPage } from "./modules/pages/MenuPage.js";
import { MigrationPage } from "./modules/pages/MigrationPage.js";
import { NotSupportedPage } from "./modules/pages/NotSupportedPage.js";
import { registerPage, showPage } from "./modules/pages/Page.js";
import { SettingsPage } from "./modules/pages/SettingsPage.js";

// Create the pages
registerPage("not-supported", new NotSupportedPage());
registerPage("connect", new ConnectPage());
registerPage("menu", new MenuPage());
registerPage("settings", new SettingsPage());
registerPage("firmware", new FirmwarePage());
registerPage("migration", new MigrationPage());
registerPage("legacy-firmware", new LegacyFirmwarePage());

// Check if the browser supports Web Bluetooth
if (!navigator.bluetooth) {
  showPage("not-supported");
} else {
  showPage("connect");
}
