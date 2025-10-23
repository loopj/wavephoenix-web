import { useSignal } from '@preact/signals';
import { html } from 'htm/preact';
import { useEffect } from 'preact/hooks';

import { connection, useDisconnectHandler } from '@/connection.js';
import { showPage } from '@/nav.js';

const WIRELESS_CHANNELS = Object.fromEntries(
  Array.from({ length: 16 }, (_, i) => [i, String(i + 1)])
);

const CONTROLLER_TYPES = {
  0: 'WaveBird',
  1: 'Wired Controller',
  2: 'Wired Controller (No Motor)',
};

const PAIRING_BUTTONS = {
  0: 'Left',
  1: 'Right',
  2: 'Down',
  3: 'Up',
  4: 'Z',
  5: 'R',
  6: 'L',
  7: 'A',
  8: 'B',
  9: 'X',
  10: 'Y',
  11: 'Start',
};

export function SettingsPage() {
  // Signals
  const wirelessChannel = useSignal(null);
  const controllerType = useSignal(null);
  const pinWirelessId = useSignal(false);
  const pairingButtons = useSignal([]);

  // Load initial settings
  useEffect(() => {
    (async () => {
      wirelessChannel.value = await connection.client.getWirelessChannel();
      controllerType.value = await connection.client.getControllerType();
      pinWirelessId.value = await connection.client.getPinWirelessId();

      const pairingButtonsInt = await connection.client.getPairingButtons();
      pairingButtons.value = Array.from({ length: 16 }, (_, i) => i)
        .filter((i) => pairingButtonsInt & (1 << i))
        .map((i) => String(i));
    })();
  }, []);

  useDisconnectHandler(() => {
    showPage('connect');
  });

  function backButtonClick() {
    showPage('menu');
  }

  async function wirelessChannelChange(event) {
    const channel = parseInt(event.target.value, 10);
    await connection.client.setWirelessChannel(channel);
  }

  async function controllerTypeChange(event) {
    const selectedType = parseInt(event.target.value, 10);
    await connection.client.setControllerType(selectedType);
  }

  async function pinWirelessIdChange(event) {
    const isChecked = event.target.checked;
    await connection.client.setPinWirelessId(isChecked);
  }

  async function pairingButtonsChange(event) {
    const selectedButtons = Array.from(event.target.selectedOptions)
      .map((option) => parseInt(option.value, 10))
      .reduce((acc, value) => acc | (1 << value), 0);

    await connection.client.setPairingButtons(selectedButtons);
  }

  return html`
    <div class="card">
      <div class="card-title connected">DEVICE SETTINGS</div>

      <div class="card-body">
        <label class="settings-row">
          Wireless Channel
          <select onChange=${wirelessChannelChange} value=${wirelessChannel.value}>
            ${Object.entries(WIRELESS_CHANNELS).map(
              ([value, label]) => html`<option value=${value}>${label}</option>`
            )}
          </select>
        </label>

        <label class="settings-row">
          Controller Type
          <select onChange=${controllerTypeChange} value=${controllerType.value}>
            ${Object.entries(CONTROLLER_TYPES).map(
              ([value, label]) => html`<option value=${value}>${label}</option>`
            )}
          </select>
        </label>

        <label class="settings-row">
          Wireless ID Pinning
          <input type="checkbox" onChange=${pinWirelessIdChange} checked=${pinWirelessId.value} />
        </label>

        <label class="settings-row">
          Pairing Buttons
          <select multiple onChange=${pairingButtonsChange}>
            ${Object.entries(PAIRING_BUTTONS).map(
              ([value, label]) =>
                html`<option value=${value} selected=${pairingButtons.value.includes(value)}>
                  ${label}
                </option>`
            )}
          </select>
        </label>
      </div>

      <div class="card-actions">
        <button class="secondary" onClick=${backButtonClick}>Back</button>
      </div>
    </div>
  `;
}
