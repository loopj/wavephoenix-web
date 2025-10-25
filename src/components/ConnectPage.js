import { useSignal } from '@preact/signals';
import { html } from 'htm/preact';

import { connect } from '@/connection.js';
import { showPage } from '@/nav.js';

function NotSupported() {
  return html`
    <div class="card">
      <div class="card-title not-supported">NOT SUPPORTED</div>

      <div class="card-body">
        <p>Your browser does not support Web Bluetooth.</p>
        <p>Please try using <b>Google Chrome</b> or a compatible browser.</p>
      </div>
    </div>
  `;
}

export function ConnectPage() {
  // Signals
  const loading = useSignal(false);
  const connectInfo = useSignal('');

  async function connectButtonClick() {
    loading.value = true;

    try {
      // Connect to the device and change to the appropriate page
      const connection = await connect();
      if (connection.mode === 'management') {
        showPage('menu');
      } else if (connection.mode === 'migration') {
        showPage('migration');
      } else if (connection.mode === 'legacy') {
        showPage('menu');
      }
    } catch (e) {
      if (e.code === 'ECANCELED') {
        // Ignore user cancellation
      } else if (e.code === 'ETIMEDOUT') {
        connectInfo.value = 'Connection timed out. Please try again.';
      } else {
        connectInfo.value = 'Bluetooth connection failed. Please try again.';
        console.error('Bluetooth connection failed', e);
      }
    }

    loading.value = false;
  }

  if (!('bluetooth' in navigator)) {
    return html`<${NotSupported} />`;
  }

  return html`
    <div class="card">
      <div class="card-title not-connected">NOT CONNECTED</div>

      <div class="card-body">
        <p>${connectInfo.value || 'Welcome to the WavePhoenix Web!'}</p>
        <p>Hold the pair button on your WavePhoenix for 3 seconds to enter management mode.</p>
        <p>
          Once in management mode, click <em>Connect to Device</em>, select your WavePhoenix device
          from the list, and click <em>Pair</em>.
        </p>
      </div>

      <div class="card-actions">
        <button class=${`primary${loading.value ? ' loading' : ''}`} onClick=${connectButtonClick}>
          Connect to Device
        </button>
      </div>
    </div>
  `;
}
