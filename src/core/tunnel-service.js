import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { spawnSSH, waitForSocks } from '../tunnel/ssh.js';
import { startTlsBackground } from '../tunnel/tls.js';
import { startWgTunnel, stopWgTunnel } from '../tunnel/wg.js';
import { enableKillSwitch, disableKillSwitch } from '../utils/kill-switch.js';
import { loadDaemonState, clearDaemonState, killPid, saveDaemonState } from '../utils/daemon.js';
import { TUNNEL_PID_FILE, TUNNEL_CONFIG_FILE, CONFIG_DIR, ensureDir } from '../utils/config.js';

const WG_CONF = path.join(CONFIG_DIR, 'wg', 'wg0.conf');

export const getActiveTunnel = () => {
  const info = loadDaemonState(TUNNEL_PID_FILE, TUNNEL_CONFIG_FILE);
  if (!info) return null;

  // For WireGuard, PID file tracks start process, but we verify interface status
  if (info.mode === 'wireguard') {
    try {
      const showRes = spawnSync('sudo', ['wg', 'show'], { encoding: 'utf-8' });
      if (showRes.status !== 0 || !showRes.stdout.includes('interface:')) {
        clearDaemonState(TUNNEL_PID_FILE, TUNNEL_CONFIG_FILE);
        return null;
      }
    } catch (e) {
      clearDaemonState(TUNNEL_PID_FILE, TUNNEL_CONFIG_FILE);
      return null;
    }
  }
  return info;
};

export const stopActiveTunnel = () => {
  const info = getActiveTunnel();
  if (info) {
    if (info.mode === 'wireguard') {
      stopWgTunnel(WG_CONF);
      disableKillSwitch(info.server);
    } else {
      killPid(info.pid);
    }
  }
  clearDaemonState(TUNNEL_PID_FILE, TUNNEL_CONFIG_FILE);
  return info;
};

export const startTunnel = async (server, port, mode = 'ssh') => {
  const hostPart = server.includes('@') ? server.split('@')[1] : server;
  ensureDir();

  let pid;
  if (mode === 'wireguard') {
    if (!fs.existsSync(WG_CONF)) {
      throw new Error(`WireGuard client configuration not found at ${WG_CONF}. Please provision the server first with "polaris deploy".`);
    }

    pid = startWgTunnel(WG_CONF);
    
    // Save state before enableKillSwitch in case sudo prompt needs to block
    saveDaemonState(TUNNEL_PID_FILE, TUNNEL_CONFIG_FILE, {
      pid,
      server,
      port: 0,
      mode: 'wireguard',
      startTime: new Date().toISOString()
    });

    enableKillSwitch(server);
    return { pid, server, port: 0, mode: 'wireguard' };
  } 
  
  if (mode === 'tls') {
    pid = startTlsBackground(port, hostPart, 8443);
  } else {
    pid = spawnSSH(server, port);
    saveDaemonState(TUNNEL_PID_FILE, TUNNEL_CONFIG_FILE, {
      pid,
      server,
      port,
      mode: 'ssh',
      startTime: new Date().toISOString()
    });
  }

  await waitForSocks(port);
  return { pid, server, port, mode };
};
