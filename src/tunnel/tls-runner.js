import { createSocksToTlsProxy } from './tls.js';
import tls from 'tls';
import notifier from 'node-notifier';

const localPort = parseInt(process.env.POLARIS_LOCAL_PORT || '1080', 10);
const remoteServer = process.env.POLARIS_REMOTE_SERVER;
const remotePort = parseInt(process.env.POLARIS_REMOTE_PORT || '8443', 10);

let proxyServer = createSocksToTlsProxy(localPort, remoteServer, remotePort);

// Keepalive pings & Auto-reconnect
const checkConnection = async () => {
  return new Promise((resolve) => {
    const socket = tls.connect({
      host: remoteServer,
      port: remotePort,
      rejectUnauthorized: false,
      timeout: 5000
    }, () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
};

const reconnect = async (attempt = 1) => {
  if (attempt > 5) {
    notifier.notify({
      title: 'Polaris VPN',
      message: 'Failed to reconnect after 5 attempts. Tunnel stopped.'
    });
    process.exit(1);
  }
  
  notifier.notify({
    title: 'Polaris VPN',
    message: `Connection lost. Reconnecting (attempt ${attempt}/5)...`
  });

  try {
    proxyServer.close();
  } catch (e) {}

  // Wait with exponential backoff
  await new Promise(r => setTimeout(r, Math.pow(2, attempt) * 1000));

  try {
    proxyServer = createSocksToTlsProxy(localPort, remoteServer, remotePort);
    const alive = await checkConnection();
    if (alive) {
      notifier.notify({
        title: 'Polaris VPN',
        message: 'Reconnected successfully.'
      });
      startInterval();
    } else {
      reconnect(attempt + 1);
    }
  } catch (err) {
    reconnect(attempt + 1);
  }
};

let intervalId;
const startInterval = () => {
  intervalId = setInterval(async () => {
    const isAlive = await checkConnection();
    if (!isAlive) {
      clearInterval(intervalId);
      reconnect();
    }
  }, 30000);
};

startInterval();
