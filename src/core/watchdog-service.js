import { spawnSync } from 'child_process';
import os from 'os';
import path from 'path';
import fs from 'fs';
import { getActiveTunnel } from './tunnel-service.js';
import { stopWgTunnel, startWgTunnel } from '../tunnel/wg.js';
import { CONFIG_DIR } from '../utils/config.js';
import { logEvent } from '../utils/logger.js';
import { sendNotification } from '../utils/notifier.js';

let watchdogTimer = null;
let consecutiveFailures = 0;
let lastCheckTime = null;
let lastStatus = 'IDLE';

const WG_CONF = path.join(CONFIG_DIR, 'wg', 'wg0.conf');
const AWG_CONF = path.join(CONFIG_DIR, 'wg', 'awg0.conf');

export const pingGateway = (ip = '10.0.0.1', timeoutMs = 2000) => {
  const isWin = os.platform() === 'win32';
  const flag = isWin ? '-n' : '-c';
  const timeoutFlag = isWin ? '-w' : '-W';
  const timeoutVal = isWin ? String(timeoutMs) : String(Math.max(1, Math.round(timeoutMs / 1000)));

  try {
    const res = spawnSync('ping', [flag, '1', timeoutFlag, timeoutVal, ip], { encoding: 'utf-8', timeout: timeoutMs + 500 });
    return res.status === 0;
  } catch (e) {
    return false;
  }
};

export const runWatchdogCheck = async () => {
  const active = getActiveTunnel();
  lastCheckTime = new Date().toISOString();

  if (!active) {
    lastStatus = 'NO_ACTIVE_TUNNEL';
    consecutiveFailures = 0;
    return { healthy: false, reason: 'No active tunnel running' };
  }

  const isFullTunnel = active.mode === 'wireguard' || active.mode === 'amneziawg';
  if (!isFullTunnel) {
    lastStatus = 'HEALTHY';
    return { healthy: true, mode: active.mode };
  }

  const ok = pingGateway('10.0.0.1', 2000);
  if (ok) {
    consecutiveFailures = 0;
    lastStatus = 'HEALTHY';
    return { healthy: true, consecutiveFailures: 0 };
  }

  consecutiveFailures += 1;
  lastStatus = `DEGRADED (${consecutiveFailures}/3)`;

  if (consecutiveFailures >= 3) {
    lastStatus = 'RECONNECTING';
    logEvent('WATCHDOG', `Tunnel gateway 10.0.0.1 unreachable 3 times. Auto-reconnecting...`, { mode: active.mode });
    
    try {
      const isAwg = active.mode === 'amneziawg';
      const confPath = isAwg ? AWG_CONF : WG_CONF;
      if (fs.existsSync(confPath)) {
        stopWgTunnel(confPath, true, isAwg);
        await new Promise(r => setTimeout(r, 1000));
        startWgTunnel(confPath, true, isAwg);
        logEvent('WATCHDOG', `Tunnel restarted successfully by watchdog`);
        sendNotification({
          title: 'Polaris Watchdog Auto-Healed',
          message: 'VPN gateway heartbeat was lost and tunnel was cleanly re-established.',
          type: 'info'
        });
      }
    } catch (err) {
      logEvent('ERROR', `Watchdog auto-reconnect failed: ${err.message}`);
      sendNotification({
        title: 'Polaris Watchdog Warning',
        message: `Failed to auto-reconnect tunnel: ${err.message}`,
        type: 'error'
      });
    }
    consecutiveFailures = 0;
    lastStatus = 'RECONNECTED';
  }

  return { healthy: false, consecutiveFailures, status: lastStatus };
};

export const startWatchdog = (intervalMs = 15000) => {
  if (watchdogTimer) return;
  watchdogTimer = setInterval(runWatchdogCheck, intervalMs);
  if (watchdogTimer.unref) watchdogTimer.unref();
  lastStatus = 'RUNNING';
};

export const stopWatchdog = () => {
  if (watchdogTimer) {
    clearInterval(watchdogTimer);
    watchdogTimer = null;
  }
  lastStatus = 'STOPPED';
};

export const getWatchdogStatus = () => {
  return {
    running: Boolean(watchdogTimer),
    lastStatus,
    lastCheckTime,
    consecutiveFailures
  };
};
