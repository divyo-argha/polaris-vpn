import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import { store } from './config.js';

export const isKillSwitchConfigured = () => {
  return store.get('kill-switch', false);
};

export const setKillSwitchConfig = (enabled) => {
  store.set('kill-switch', enabled);
};

export const enableKillSwitch = (serverIp) => {
  if (!isKillSwitchConfigured()) return;
  
  const platform = os.platform();
  const hostIp = serverIp.includes('@') ? serverIp.split('@')[1] : serverIp;

  try {
    if (platform === 'linux') {
      // 1. Loopback
      execSync('sudo iptables -C OUTPUT -o lo -j ACCEPT || sudo iptables -A OUTPUT -o lo -j ACCEPT', { stdio: 'ignore' });
      // 2. WireGuard interface (default wg0)
      execSync('sudo iptables -C OUTPUT -o wg0 -j ACCEPT || sudo iptables -A OUTPUT -o wg0 -j ACCEPT', { stdio: 'ignore' });
      // 3. Connect to the VPS server
      execSync(`sudo iptables -C OUTPUT -d ${hostIp} -j ACCEPT || sudo iptables -A OUTPUT -d ${hostIp} -j ACCEPT`, { stdio: 'ignore' });
      // 4. Drop other outbound connections
      execSync('sudo iptables -C OUTPUT -j REJECT || sudo iptables -A OUTPUT -j REJECT', { stdio: 'ignore' });
    } else if (platform === 'darwin') {
      // macOS Packet Filter (PF) setup
      const pfRules = `
block out all
pass out on lo0 all
pass out on utun all
pass out proto {tcp, udp} to ${hostIp}
`;
      fs.writeFileSync('/tmp/polaris_pf.conf', pfRules, 'utf-8');
      execSync('sudo pfctl -ef /tmp/polaris_pf.conf', { stdio: 'ignore' });
    }
  } catch (err) {
    console.error('Failed to enable kill switch rules:', err.message);
  }
};

export const disableKillSwitch = (serverIp) => {
  const platform = os.platform();
  const hostIp = serverIp.includes('@') ? serverIp.split('@')[1] : serverIp;

  try {
    if (platform === 'linux') {
      execSync('sudo iptables -D OUTPUT -j REJECT', { stdio: 'ignore' });
      execSync(`sudo iptables -D OUTPUT -d ${hostIp} -j ACCEPT`, { stdio: 'ignore' });
      execSync('sudo iptables -D OUTPUT -o wg0 -j ACCEPT', { stdio: 'ignore' });
      execSync('sudo iptables -D OUTPUT -o lo -j ACCEPT', { stdio: 'ignore' });
    } else if (platform === 'darwin') {
      execSync('sudo pfctl -d', { stdio: 'ignore' });
      // Reload default system rules
      if (fs.existsSync('/etc/pf.conf')) {
        execSync('sudo pfctl -f /etc/pf.conf', { stdio: 'ignore' });
      }
      if (fs.existsSync('/tmp/polaris_pf.conf')) {
        fs.unlinkSync('/tmp/polaris_pf.conf');
      }
    }
  } catch (err) {
    // Ignore cleanup errors
  }
};
