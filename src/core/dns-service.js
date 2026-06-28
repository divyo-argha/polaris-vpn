import path from 'path';
import { fileURLToPath } from 'url';
import { spawnDaemon, loadDaemonState, clearDaemonState, killPid, saveDaemonState } from '../utils/daemon.js';
import { DNS_PID_FILE, DNS_CONFIG_FILE, ensureDir } from '../utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getDnsStatus = () => {
  return loadDaemonState(DNS_PID_FILE, DNS_CONFIG_FILE);
};

export const startDnsResolver = (port = 5354, upstream = 'https://cloudflare-dns.com/dns-query') => {
  const active = getDnsStatus();
  if (active) {
    throw new Error(`DNS resolver is already running (PID: ${active.pid})`);
  }

  ensureDir();
  
  // Point to static runner relative to this file
  const serverScript = path.resolve(__dirname, '..', 'net', 'dns-runner.js');

  const pid = spawnDaemon(serverScript, [], {
    POLARIS_DNS_PORT: String(port),
    POLARIS_DNS_UPSTREAM: upstream
  });

  saveDaemonState(DNS_PID_FILE, DNS_CONFIG_FILE, {
    pid,
    port,
    upstream,
    startTime: new Date().toISOString()
  });

  return { pid, port, upstream };
};

export const stopDnsResolver = () => {
  const active = getDnsStatus();
  if (active) {
    killPid(active.pid);
  }
  clearDaemonState(DNS_PID_FILE, DNS_CONFIG_FILE);
  return active;
};
