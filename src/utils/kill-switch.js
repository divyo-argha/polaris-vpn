import { execSync, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const TMP_PF_CONF = path.join(os.tmpdir(), 'polaris-killswitch.conf');
const DEFAULT_PF_CONF = '/etc/pf.conf';


const extractHost = (serverStr) => {
  if (!serverStr) return null;
  return serverStr.includes('@') ? serverStr.split('@')[1] : serverStr;
};


export const enableKillSwitch = (serverIp) => {
  const hostIp = extractHost(serverIp);
  if (!hostIp) return;

  const platform = os.platform();

  try {
    if (platform === 'linux') {
      // 1. Loopback & Local LAN (RFC1918)
      execSync('sudo iptables -C OUTPUT -o lo -j ACCEPT || sudo iptables -A OUTPUT -o lo -j ACCEPT', { stdio: 'ignore' });
      execSync('sudo iptables -C OUTPUT -d 10.0.0.0/8 -j ACCEPT || sudo iptables -A OUTPUT -d 10.0.0.0/8 -j ACCEPT', { stdio: 'ignore' });
      execSync('sudo iptables -C OUTPUT -d 172.16.0.0/12 -j ACCEPT || sudo iptables -A OUTPUT -d 172.16.0.0/12 -j ACCEPT', { stdio: 'ignore' });
      execSync('sudo iptables -C OUTPUT -d 192.168.0.0/16 -j ACCEPT || sudo iptables -A OUTPUT -d 192.168.0.0/16 -j ACCEPT', { stdio: 'ignore' });
      
      // 2. WireGuard interface (default wg0, awg0)
      execSync('sudo iptables -C OUTPUT -o wg0 -j ACCEPT || sudo iptables -A OUTPUT -o wg0 -j ACCEPT', { stdio: 'ignore' });
      execSync('sudo iptables -C OUTPUT -o awg0 -j ACCEPT || sudo iptables -A OUTPUT -o awg0 -j ACCEPT', { stdio: 'ignore' });
      
      // 3. Connect to the VPS server
      execSync(`sudo iptables -C OUTPUT -d ${hostIp} -j ACCEPT || sudo iptables -A OUTPUT -d ${hostIp} -j ACCEPT`, { stdio: 'ignore' });
      
      // 4. Drop other outbound connections
      execSync('sudo iptables -C OUTPUT -j REJECT || sudo iptables -A OUTPUT -j REJECT', { stdio: 'ignore' });
    
    } else if (platform === 'darwin') {
      // macOS Packet Filter (PF) setup
      const pfRules = `
# Polaris VPN Smart Kill-Switch
block drop all
pass on lo0

# Allow local LAN traffic
pass out to 10.0.0.0/8
pass out to 172.16.0.0/12
pass out to 192.168.0.0/16

# Allow traffic over the VPN tunnel (macOS WireGuard interfaces are utun)
pass on utun

# Allow the encrypted tunnel traffic to reach the VPS
pass out proto tcp to ${hostIp}
pass out proto udp to ${hostIp}
`;
      fs.writeFileSync(TMP_PF_CONF, pfRules.trim(), 'utf-8');
      
      // Flush existing and load the kill-switch rules
      spawnSync('sudo', ['pfctl', '-e'], { stdio: 'ignore' });
      spawnSync('sudo', ['pfctl', '-f', TMP_PF_CONF], { stdio: 'ignore' });
    }
  } catch (err) {
    console.error('Failed to enable kill switch rules:', err.message);
  }
};


export const disableKillSwitch = (serverIp) => {
  const hostIp = extractHost(serverIp);
  const platform = os.platform();

  try {
    if (platform === 'linux') {
      execSync('sudo iptables -D OUTPUT -j REJECT', { stdio: 'ignore' });
      if (hostIp) execSync(`sudo iptables -D OUTPUT -d ${hostIp} -j ACCEPT`, { stdio: 'ignore' });
      execSync('sudo iptables -D OUTPUT -o wg0 -j ACCEPT', { stdio: 'ignore' });
      execSync('sudo iptables -D OUTPUT -o awg0 -j ACCEPT', { stdio: 'ignore' });
      execSync('sudo iptables -D OUTPUT -d 192.168.0.0/16 -j ACCEPT', { stdio: 'ignore' });
      execSync('sudo iptables -D OUTPUT -d 172.16.0.0/12 -j ACCEPT', { stdio: 'ignore' });
      execSync('sudo iptables -D OUTPUT -d 10.0.0.0/8 -j ACCEPT', { stdio: 'ignore' });
      execSync('sudo iptables -D OUTPUT -o lo -j ACCEPT', { stdio: 'ignore' });
    
    } else if (platform === 'darwin') {
      // Disable pf (macOS default state)
      spawnSync('sudo', ['pfctl', '-d'], { stdio: 'ignore' });
      
      // Reload default Apple rules just in case it's re-enabled later
      if (fs.existsSync(DEFAULT_PF_CONF)) {
        spawnSync('sudo', ['pfctl', '-f', DEFAULT_PF_CONF], { stdio: 'ignore' });
      }
      
      // Cleanup
      if (fs.existsSync(TMP_PF_CONF)) {
        fs.unlinkSync(TMP_PF_CONF);
      }
    }
  } catch (err) {
    // Ignore cleanup errors
  }
};
