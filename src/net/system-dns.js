import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawnSync, execSync } from 'child_process';
import { CONFIG_DIR, ensureDir } from '../utils/config.js';

const DNS_BACKUP_FILE = path.join(CONFIG_DIR, 'dns_backup.json');

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

export const backupSystemDns = () => {
  ensureDir();
  if (fs.existsSync(DNS_BACKUP_FILE)) return;

  const platform = os.platform();
  const backup = { platform, timestamp: new Date().toISOString() };

  try {
    if (platform === 'darwin') {
      const service = getActiveMacService();
      backup.service = service;
      const res = spawnSync('networksetup', ['-getdnsservers', service], { encoding: 'utf-8' });
      if (res.status === 0 && !res.stdout.includes('There aren\'t any DNS Servers')) {
        backup.dns = res.stdout.trim().split('\n').filter(Boolean);
      } else {
        backup.dns = ['Empty'];
      }
    } else if (platform === 'linux') {
      if (fs.existsSync('/etc/resolv.conf')) {
        backup.resolvConf = fs.readFileSync('/etc/resolv.conf', 'utf-8');
      }
    }
    fs.writeFileSync(DNS_BACKUP_FILE, JSON.stringify(backup, null, 2), 'utf-8');
  } catch (err) {}
};

export const setSystemDns = (dnsServers = ['127.0.0.1']) => {
  backupSystemDns();
  const platform = os.platform();

  try {
    if (platform === 'darwin') {
      const service = getActiveMacService();
      spawnSync('networksetup', ['-setdnsservers', service, ...dnsServers], { stdio: 'ignore' });
    } else if (platform === 'linux') {
      const content = dnsServers.map(s => `nameserver ${s}`).join('\n') + '\n';
      execSync(`echo "${content.trim()}" | sudo tee /etc/resolv.conf > /dev/null`, { stdio: 'ignore' });
    }
    return true;
  } catch (err) {
    return false;
  }
};

export const restoreSystemDns = () => {
  if (!fs.existsSync(DNS_BACKUP_FILE)) return false;

  try {
    const backup = JSON.parse(fs.readFileSync(DNS_BACKUP_FILE, 'utf-8'));
    const platform = os.platform();

    if (platform === 'darwin') {
      const service = backup.service || getActiveMacService();
      if (backup.dns && backup.dns.length > 0 && backup.dns[0] !== 'Empty') {
        spawnSync('networksetup', ['-setdnsservers', service, ...backup.dns], { stdio: 'ignore' });
      } else {
        spawnSync('networksetup', ['-setdnsservers', service, 'Empty'], { stdio: 'ignore' });
      }
    } else if (platform === 'linux') {
      if (backup.resolvConf) {
        execSync(`cat << 'EOF' | sudo tee /etc/resolv.conf > /dev/null\n${backup.resolvConf}\nEOF`, { stdio: 'ignore' });
      }
    }
    fs.unlinkSync(DNS_BACKUP_FILE);
    return true;
  } catch (err) {
    return false;
  }
};
