import os from 'os';
import { spawnSync } from 'child_process';
import chalk from 'chalk';
import { printSuccess, printWarning, printInfo, printBox, isNoColor } from '../utils/display.js';
import { getProfiles } from '../core/profile-service.js';

export const runEnvironmentDiagnostic = () => {
  const results = [];

  // Check Node.js version
  const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
  results.push({
    item: 'Node.js Runtime',
    status: nodeMajor >= 18 ? 'PASS' : 'WARN',
    detail: `v${process.versions.node} (>= 18 required)`
  });

  // Check WireGuard CLI
  let hasWg = false;
  try {
    const wgCheck = spawnSync('which', ['wg'], { encoding: 'utf-8' });
    hasWg = wgCheck.status === 0;
  } catch (e) {}

  results.push({
    item: 'WireGuard CLI (wg)',
    status: hasWg ? 'PASS' : 'WARN',
    detail: hasWg ? 'Available' : 'Missing (required for WireGuard full tunnels)'
  });

  // Check Ping / ICMP
  let hasPing = false;
  try {
    const pingCheck = spawnSync('which', ['ping'], { encoding: 'utf-8' });
    hasPing = pingCheck.status === 0;
  } catch (e) {}

  results.push({
    item: 'Network ICMP (ping)',
    status: hasPing ? 'PASS' : 'WARN',
    detail: hasPing ? 'Available' : 'Missing'
  });

  // Check Config Store
  const { profiles } = getProfiles();
  const profileCount = Object.keys(profiles).length;
  results.push({
    item: 'Saved Server Profiles',
    status: profileCount > 0 ? 'PASS' : 'INFO',
    detail: `${profileCount} server profile(s) configured`
  });

  return results;
};

export default async (options = {}) => {
  const isJson = Boolean(options.json);

  const diagnostics = runEnvironmentDiagnostic();

  if (isJson) {
    console.log(JSON.stringify({ diagnostics }));
    return;
  }

  console.log('\n  ' + chalk.bold.cyan('◈  Polaris VPN — Health & Onboarding Wizard\n'));
  console.log('  System Diagnostics:');
  console.log('  ' + '─'.repeat(54));

  diagnostics.forEach(({ item, status, detail }) => {
    let badge;
    if (isNoColor()) {
      badge = status === 'PASS' ? '[PASS] ✓' : (status === 'WARN' ? '[WARN] ⚠' : '[INFO] ℹ');
    } else {
      badge = status === 'PASS' 
        ? chalk.green.bold('✓ PASS') 
        : (status === 'WARN' ? chalk.yellow.bold('⚠ WARN') : chalk.cyan.bold('ℹ INFO'));
    }
    console.log(`  ${badge.padEnd(isNoColor() ? 12 : 20)} ${item.padEnd(24)} ${chalk.dim(detail)}`);
  });

  console.log('  ' + '─'.repeat(54) + '\n');

  const hasMissingWg = diagnostics.some(d => d.item.includes('WireGuard') && d.status === 'WARN');
  if (hasMissingWg) {
    console.log(chalk.yellow.bold('  💡 Recommended Action:'));
    console.log(chalk.dim('     Install wireguard-tools to enable high-speed WireGuard tunnels:'));
    if (os.platform() === 'darwin') {
      console.log(chalk.dim('     • brew install wireguard-tools\n'));
    } else {
      console.log(chalk.dim('     • sudo apt install wireguard-tools  (Debian/Ubuntu)'));
      console.log(chalk.dim('     • sudo dnf install wireguard-tools  (Fedora/RHEL/CentOS)\n'));
    }
  }

  const { profiles } = getProfiles();
  const names = Object.keys(profiles);

  if (names.length === 0) {
    printBox(
      'Get Started with Polaris',
      'You do not have any saved servers configured yet.\n\n' +
      '• To provision any Linux VPS (Oracle Cloud, AWS, DigitalOcean):\n' +
      '  polaris deploy -s user@vps-ip\n\n' +
      '• To save an existing SSH tunnel profile:\n' +
      '  polaris add my-server -s user@vps-ip\n\n' +
      '• To import an existing WireGuard configuration (.conf):\n' +
      '  polaris import client.conf -a my-server\n\n' +
      '• To launch the graphical TUI dashboard:\n' +
      '  polaris',
      'info'
    );
  } else {
    printSuccess(`Environment configured with ${names.length} server profile(s).`);
    console.log(chalk.dim(`  Run "polaris start" or "polaris" to connect.`));
  }
};
