import fs from 'fs';
import { spawn } from 'child_process';

export const isPidAlive = (pid) => {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return false;
  }
};

export const killPid = (pid, signal = 'SIGTERM') => {
  if (!pid) return;
  try {
    process.kill(pid, signal);
  } catch (e) {
    // Ignore if already dead
  }
};

export const spawnDaemon = (scriptPath, args = [], env = {}) => {
  const child = spawn('node', [scriptPath, ...args], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      ...env
    }
  });
  child.unref();
  return child.pid;
};

export const saveDaemonState = (pidFile, configFile, data) => {
  fs.writeFileSync(pidFile, String(data.pid), 'utf-8');
  fs.writeFileSync(configFile, JSON.stringify(data, null, 2), 'utf-8');
};

export const loadDaemonState = (pidFile, configFile) => {
  if (!fs.existsSync(pidFile) || !fs.existsSync(configFile)) {
    return null;
  }

  try {
    const pid = parseInt(fs.readFileSync(pidFile, 'utf-8').trim(), 10);
    const config = JSON.parse(fs.readFileSync(configFile, 'utf-8'));

    if (!isPidAlive(pid)) {
      clearDaemonState(pidFile, configFile);
      return null;
    }

    return { pid, ...config };
  } catch (err) {
    return null;
  }
};

export const clearDaemonState = (pidFile, configFile) => {
  try {
    if (fs.existsSync(pidFile)) fs.unlinkSync(pidFile);
  } catch (e) {}
  try {
    if (fs.existsSync(configFile)) fs.unlinkSync(configFile);
  } catch (e) {}
};
