import Pusher from 'pusher-js';

let pusherInstance = null;
let isConnecting = false;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

export function getReverbConfig() {
  const scheme = import.meta.env.VITE_REVERB_SCHEME || 'http';

  // If not explicitly configured, infer host from current origin.
  // This avoids hardcoding `localhost` when the app is opened via a different hostname.
  const host = import.meta.env.VITE_REVERB_HOST || window.location.hostname;

  // Keep current default port to avoid breaking existing local setups.
  // If you use TLS, still set VITE_REVERB_PORT to the Reverb TLS port.
  const port = import.meta.env.VITE_REVERB_PORT || '8080';

  return {
    key: import.meta.env.VITE_REVERB_APP_KEY || 'qm43lycb8xdegr53urc6',
    host,
    port,
    scheme,
  };
}

export function getReverbUrl() {
  const config = getReverbConfig();
  return `${config.scheme}://${config.host}:${config.port}`;
}

export function initPusher() {
  if (pusherInstance) {
    return pusherInstance;
  }

  if (isConnecting) {
    return null;
  }

  isConnecting = true;
  const config = getReverbConfig();

  try {
    const isTLS = String(config.scheme).toLowerCase() === 'https';

    pusherInstance = new Pusher(config.key, {
      wsHost: config.host,
      wsPort: config.port,
      wssPort: config.port,
      forceTLS: isTLS,
      // Avoid trying ws and wss when only one should work for your setup.
      enabledTransports: isTLS ? ['wss'] : ['ws'],
      disableStats: true,
      cluster: 'default',
    });

    pusherInstance.connection.bind('connected', () => {
      console.log('[Reverb] Connected to', getReverbUrl());
      isConnecting = false;
      reconnectAttempts = 0;
    });

    pusherInstance.connection.bind('disconnected', () => {
      console.log('[Reverb] Disconnected');
      isConnecting = false;
      attemptReconnect();
    });

    pusherInstance.connection.bind('error', (err) => {
      console.error('[Reverb] Error:', err);
      isConnecting = false;
    });

  } catch (error) {
    console.error('[Reverb] Init error:', error);
    isConnecting = false;
  }

  return pusherInstance;
}

function attemptReconnect() {
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.warn('[Reverb] Max reconnect attempts reached');
    return;
  }

  reconnectAttempts++;
  console.log(`[Reverb] Reconnecting (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);

  pusherInstance = null;
  setTimeout(() => {
    initPusher();
  }, 3000);
}

export function subscribeToChannel(channelName) {
  const pusher = initPusher();
  if (!pusher) {
    console.warn('[Reverb] Pusher not initialized');
    return null;
  }

  return pusher.subscribe(channelName);
}

export function unsubscribeFromChannel(channelName) {
  if (pusherInstance) {
    pusherInstance.unsubscribe(channelName);
  }
}

export function disconnectPusher() {
  if (pusherInstance) {
    pusherInstance.disconnect();
    pusherInstance = null;
  }
}

export default {
  init: initPusher,
  subscribe: subscribeToChannel,
  unsubscribe: unsubscribeFromChannel,
  disconnect: disconnectPusher,
  getConfig: getReverbConfig,
};