import express from 'express';
import { getActiveTunnel, startTunnel, stopActiveTunnel } from '../core/tunnel-service.js';
import { listPeers } from '../core/peer-service.js';
import { getProfiles } from '../core/profile-service.js';

export const startApiServer = (port = 7070) => {
  const app = express();
  app.use(express.json());

  app.get('/status', (req, res) => {
    try {
      const info = getActiveTunnel();
      if (!info) {
        return res.json({ status: 'disconnected' });
      }
      res.json({ status: 'connected', ...info });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/connect', async (req, res) => {
    try {
      const { server, mode, proxyPort } = req.body;
      let targetServer = server;

      if (!targetServer) {
        const { profiles, active } = getProfiles();
        if (active && profiles[active]) {
          targetServer = profiles[active];
        } else {
          return res.status(400).json({ error: 'No server specified and no active profile found.' });
        }
      }

      const info = getActiveTunnel();
      if (info) {
        return res.status(400).json({ error: 'Tunnel is already active.', current: info });
      }

      const pPort = proxyPort || 1080;
      const tMode = mode || 'auto';

      const result = await startTunnel(targetServer, pPort, tMode, true);
      res.json({ status: 'connected', ...result });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/disconnect', (req, res) => {
    try {
      const info = stopActiveTunnel(true);
      if (!info) {
        return res.json({ status: 'disconnected', message: 'No active tunnel.' });
      }
      res.json({ status: 'disconnected', message: 'Tunnel stopped successfully.' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/peers', async (req, res) => {
    try {
      const peers = await listPeers();
      res.json({ success: true, peers });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  return new Promise((resolve, reject) => {
    const server = app.listen(port, '127.0.0.1', () => {
      resolve(server);
    }).on('error', reject);
  });
};
