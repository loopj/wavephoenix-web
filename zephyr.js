import { Management } from "./modules/management.js";
import { registerPage, showPage } from "./modules/page.js";
import { ConnectPage } from "./modules/pages/ConnectPage.js";
import { FirmwarePage } from "./modules/pages/FirmwarePage.js";
import { MenuPage } from "./modules/pages/MenuPage.js";
import { NotSupportedPage } from "./modules/pages/NotSupportedPage.js";
import { SettingsPage } from "./modules/pages/SettingsPage.js";

// Create the management client
const client = new Management();
client.setDisconnectCallback(() => {
  showPage("connect");
  client.clearDevice();
});

// Create the pages
registerPage("not-supported", new NotSupportedPage());
registerPage("connect", new ConnectPage(client));
registerPage("menu", new MenuPage(client));
registerPage("settings", new SettingsPage(client));
registerPage("firmware", new FirmwarePage(client));

// Check if the browser supports Web Bluetooth
if (!navigator.bluetooth) {
  showPage("not-supported");
} else {
  showPage("connect");
}
