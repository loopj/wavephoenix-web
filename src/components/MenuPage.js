import { html } from 'htm/preact';

import { useDisconnectHandler, connection, version } from '@/connection.js';
import { showPage } from '@/nav.js';
import { semverToString } from '@/utils.js';

export function MenuPage() {
  useDisconnectHandler(() => {
    showPage('connect');
  });

  function settingsButtonClick() {
    showPage('settings');
  }

  function firmwareButtonClick() {
    showPage('firmware');
  }

  async function exitButtonClick() {
    // Tell the device to leave management mode
    if (connection.mode === 'management') {
      await connection.client.leaveSettings();
    } else {
      await connection.client.disconnect();
    }

    // Show the connect page
    showPage('connect');
  }

  return html`
    <div class="card">
      <div class="card-title connected">WAVEPHOENIX CONNECTED</div>

      <div class="card-body">
        <p>Current firmware version: ${semverToString(version.value)}</p>

        <button onClick=${firmwareButtonClick} class="primary menu-item">Firmware Update</button>

        ${connection.mode === 'management' &&
        html`
          <button onClick=${settingsButtonClick} class="primary menu-item">Device Settings</button>
        `}
      </div>

      <div class="card-actions">
        <button onClick=${exitButtonClick} class="secondary">Exit Management Mode</button>
      </div>
    </div>
  `;
}
