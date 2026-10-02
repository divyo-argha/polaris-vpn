import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync } from 'child_process';
import { CONFIG_DIR, ensureDir } from '../utils/config.js';

const PROXY_BACKUP_FILE = path.join(CONFIG_DIR, 'proxy_backup.json');

const getActiveMacService = () => {
  try {
    const routeRes = spawnSync('route', ['get', 'default'], { encoding: 'utf-8' });
    if (routeRes.status === 0) {
      const match = routeRes.stdout.match(/interface:\s*(\w+)/);
      if (match) {
        const iface = match[1];
        const servicesRes = spawnSync('networksetup', ['-listallhardwareports'], { encoding: 'utf-8' });
        if (servicesRes.status === 0) {
          const lines = servicesRes.stdout.split('\n');
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(`Device: ${iface}`)) {
              const prevLine = lines[i - 1] || '';
              const matchService = prevLine.match(/Hardware Port:\s*(.+)/);
              if (matchService) return matchService[1].trim();
            }
          }
        }
      }
    }
  } catch (err) {}
  return 'Wi-Fi';
};

export const backupSystemProxy = () => {
  ensureDir();
  if (fs.existsSync(PROXY_BACKUP_FILE)) return;

  const platform = os.platform();
  const backup = { platform, timestamp: new Date().toISOString() };

  try {
    if (platform === 'darwin') {
      const service = getActiveMacService();
      backup.service = service;
      const res = spawnSync('networksetup', ['-getsocksfirewallproxy', service], { encoding: 'utf-8' });
      if (res.status === 0) {
        backup.enabled = res.stdout.includes('Enabled: Yes');
        const serverMatch = res.stdout.match(/Server:\s*(\S+)/);
        const portMatch = res.stdout.match(/Port:\s*(\d+)/);
        backup.server = serverMatch ? serverMatch[1] : '';
        backup.port = portMatch ? portMatch[1] : '';
      }
    }
    fs.writeFileSync(PROXY_BACKUP_FILE, JSON.stringify(backup, null, 2), 'utf-8');
  } catch (err) {}
};

export const enableSystemProxy = (port = 1080, host = '127.0.0.1') => {
  backupSystemProxy();
  const platform = os.platform();

  try {
    if (platform === 'darwin') {
      const service = getActiveMacService();
      spawnSync('networksetup', ['-setsocksfirewallproxy', service, host, String(port)], { stdio: 'ignore' });
      spawnSync('networksetup', ['-setsocksfirewallproxystate', service, 'on'], { stdio: 'ignore' });
      return true;
    } else if (platform === 'linux') {
      if (process.env.DESKTOP_SESSION || process.env.XDG_CURRENT_DESKTOP) {
        spawnSync('gsettings', ['set', 'org.gnome.system.proxy.socks', 'host', host], { stdio: 'ignore' });
        spawnSync('gsettings', ['set', 'org.gnome.system.proxy.socks', 'port', String(port)], { stdio: 'ignore' });
        spawnSync('gsettings', ['set', 'org.gnome.system.proxy', 'mode', 'manual'], { stdio: 'ignore' });
      }
      return true;
    }
  } catch (err) {}
  return false;
};

export const disableSystemProxy = () => {
  const platform = os.platform();

  try {
    if (platform === 'darwin') {
      const service = getActiveMacService();
      spawnSync('networksetup', ['-setsocksfirewallproxystate', service, 'off'], { stdio: 'ignore' });
    } else if (platform === 'linux') {
      if (process.env.DESKTOP_SESSION || process.env.XDG_CURRENT_DESKTOP) {
        spawnSync('gsettings', ['set', 'org.gnome.system.proxy', 'mode', 'none'], { stdio: 'ignore' });
      }
    }

    if (fs.existsSync(PROXY_BACKUP_FILE)) {
      try {
        const backup = JSON.parse(fs.readFileSync(PROXY_BACKUP_FILE, 'utf-8'));
        if (platform === 'darwin' && backup.enabled && backup.server && backup.port) {
          spawnSync('networksetup', ['-setsocksfirewallproxy', backup.service || 'Wi-Fi', backup.server, backup.port], { stdio: 'ignore' });
          spawnSync('networksetup', ['-setsocksfirewallproxystate', backup.service || 'Wi-Fi', 'on'], { stdio: 'ignore' });
        }
      } catch (e) {}
      fs.unlinkSync(PROXY_BACKUP_FILE);
    }
    return true;
  } catch (err) {
    return false;
  }
};
