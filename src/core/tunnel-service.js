import { spawnSSH, waitForSocks } from '../tunnel/ssh.js';
import { startTlsBackground } from '../tunnel/tls.js';
import { loadDaemonState, clearDaemonState, killPid, saveDaemonState } from '../utils/daemon.js';
import { TUNNEL_PID_FILE, TUNNEL_CONFIG_FILE, ensureDir } from '../utils/config.js';

export const getActiveTunnel = () => {
  return loadDaemonState(TUNNEL_PID_FILE, TUNNEL_CONFIG_FILE);
};

export const stopActiveTunnel = () => {
  const info = getActiveTunnel();
  if (info) {
    killPid(info.pid);
  }
  clearDaemonState(TUNNEL_PID_FILE, TUNNEL_CONFIG_FILE);
  return info;
};

export const startTunnel = async (server, port, mode = 'ssh') => {
  const hostPart = server.includes('@') ? server.split('@')[1] : server;
  ensureDir();

  let pid;
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
