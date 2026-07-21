#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import updateNotifier from 'update-notifier';
import { spawnSync } from 'child_process';
import { printBanner, printError, printSuccess } from './utils/display.js';
import { handleError } from './utils/error-handler.js';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkg = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));

updateNotifier({ pkg }).notify();

const program = new Command();

program
  .name('polaris')
  .description(pkg.description)
  .version(pkg.version)
  .option('--json', 'Output results in JSON format');

// Helper to check if we should print the banner
const willPrintJson = () => process.argv.includes('--json');

program
  .command('update')
  .description('Update polaris-vpn to the latest version')
  .action(() => {
    console.log(chalk.cyan('Updating polaris-vpn...'));
    const res = spawnSync('npm', ['install', '-g', 'polaris-vpn@latest'], { stdio: 'inherit' });
    if (res.status === 0) {
      printSuccess('Successfully updated to the latest version!');
    } else {
      printError('Failed to update polaris-vpn.');
      process.exitCode = 1;
    }
  });

program
  .command('start')
  .description('Start the encrypted SSH, TLS, WireGuard or AmneziaWG tunnel')
  .option('-s, --server <user@host>', 'SSH/TLS/WireGuard server to connect to')
  .option('-p, --port <number>', 'Local SOCKS5 port to bind', '1080')
  .option('-m, --mode <type>', 'Tunnel mode: ssh, tls, wireguard, amneziawg or auto', 'auto')
  .option('--no-doh', 'Disable automatic DoH system DNS protection')
  .option('--fastest', 'Auto-select lowest latency server profile')
  .option('--failover', 'Enable automatic multi-protocol fallback')
  .action(async (options, cmd) => {
    if (!cmd.optsWithGlobals().json) printBanner();
    try {
      const run = (await import('./commands/start.js')).default;
      await run(cmd.optsWithGlobals());
    } catch (err) {
      handleError('Command failed', err, cmd.optsWithGlobals().json);
    }
  });

program
  .command('benchmark')
  .description('Ping and measure latency across all saved server profiles')
  .action(async (options, cmd) => {
    if (!cmd.optsWithGlobals().json) printBanner();
    try {
      const run = (await import('./commands/benchmark.js')).default;
      await run(cmd.optsWithGlobals());
    } catch (err) {
      handleError('Command failed', err, cmd.optsWithGlobals().json);
    }
  });

program
  .command('stop')
  .description('Stop the active tunnel')
  .action(async (options, cmd) => {
    if (!cmd.optsWithGlobals().json) printBanner();
    try {
      const run = (await import('./commands/stop.js')).default;
      await run(cmd.optsWithGlobals());
    } catch (err) {
      handleError('Command failed', err, cmd.optsWithGlobals().json);
    }
  });

program
  .command('status')
  .description('Show current tunnel status, IP, and uptime')
  .option('--full', 'Show GeoIP, latency, and full data usage stats')
  .action(async (options, cmd) => {
    if (!cmd.optsWithGlobals().json) printBanner();
    try {
      const run = (await import('./commands/status.js')).default;
      await run(cmd.optsWithGlobals());
    } catch (err) {
      handleError('Command failed', err, cmd.optsWithGlobals().json);
    }
  });

program
  .command('dashboard')
  .description('Open the live TUI dashboard')
  .action(async (options, cmd) => {
    try {
      const run = (await import('./commands/dashboard.js')).default;
      await run(cmd.optsWithGlobals());
    } catch (err) {
      printError('Command failed', err);
      process.exit(1);
    }
  });

program
  .command('check')
  .description('Run a 3-point privacy check (IP, DNS leak, IPv6 leak)')
  .action(async (options, cmd) => {
    if (!cmd.optsWithGlobals().json) printBanner();
    try {
      const run = (await import('./commands/check.js')).default;
      await run(cmd.optsWithGlobals());
    } catch (err) {
      handleError('Command failed', err, cmd.optsWithGlobals().json);
    }
  });

program
  .command('add <alias>')
  .description('Save a server profile for quick access')
  .requiredOption('-s, --server <user@host>', 'SSH server for this profile')
  .action(async (alias, options, cmd) => {
    if (!cmd.optsWithGlobals().json) printBanner();
    try {
      const { addServer } = await import('./commands/servers.js');
      await addServer(alias, cmd.optsWithGlobals());
    } catch (err) {
      handleError('Command failed', err, cmd.optsWithGlobals().json);
    }
  });

program
  .command('list')
  .description('List all saved server profiles')
  .action(async (options, cmd) => {
    if (!cmd.optsWithGlobals().json) printBanner();
    try {
      const { listServers } = await import('./commands/servers.js');
      await listServers(cmd.optsWithGlobals());
    } catch (err) {
      handleError('Command failed', err, cmd.optsWithGlobals().json);
    }
  });

program
  .command('use <alias>')
  .description('Set a saved profile as the active default')
  .action(async (alias, options, cmd) => {
    if (!cmd.optsWithGlobals().json) printBanner();
    try {
      const { useServer } = await import('./commands/servers.js');
      await useServer(alias, cmd.optsWithGlobals());
    } catch (err) {
      handleError('Command failed', err, cmd.optsWithGlobals().json);
    }
  });

const dnsCmd = program.command('dns').description('Manage local DNS-over-HTTPS resolver');

dnsCmd
  .command('start')
  .description('Start the local DoH resolver')
  .option('-p, --port <number>', 'Local port to bind', '5354')
  .option('-u, --upstream <provider>', 'Upstream DoH provider (cloudflare, google, or custom URL)', 'cloudflare')
  .action(async (options, cmd) => {
    if (!cmd.optsWithGlobals().json) printBanner();
    try {
      const { dnsStart } = await import('./commands/dns.js');
      await dnsStart(cmd.optsWithGlobals());
    } catch (err) {
      handleError('Command failed', err, cmd.optsWithGlobals().json);
    }
  });

dnsCmd
  .command('stop')
  .description('Stop the local DoH resolver')
  .action(async (options, cmd) => {
    if (!cmd.optsWithGlobals().json) printBanner();
    try {
      const { dnsStop } = await import('./commands/dns.js');
      await dnsStop(cmd.optsWithGlobals());
    } catch (err) {
      handleError('Command failed', err, cmd.optsWithGlobals().json);
    }
  });

dnsCmd
  .command('status')
  .description('Show local DoH resolver status')
  .action(async (options, cmd) => {
    if (!cmd.optsWithGlobals().json) printBanner();
    try {
      const { dnsStatus } = await import('./commands/dns.js');
      await dnsStatus(cmd.optsWithGlobals());
    } catch (err) {
      handleError('Command failed', err, cmd.optsWithGlobals().json);
    }
  });

program
  .command('deploy')
  .description('Provision a remote server with WireGuard or AmneziaWG')
  .requiredOption('-s, --server <user@host>', 'SSH server to configure')
  .option('-i, --identity <path>', 'SSH private key file path')
  .option('-p, --password <password>', 'SSH password (alternative to identity)')
  .option('-m, --mode <type>', 'Tunnel mode: wireguard or amneziawg', 'wireguard')
  .action(async (options, cmd) => {
    if (!cmd.optsWithGlobals().json) printBanner();
    try {
      const run = (await import('./commands/deploy.js')).default;
      await run(cmd.optsWithGlobals());
    } catch (err) {
      handleError('Command failed', err, cmd.optsWithGlobals().json);
    }
  });

const ksCmd = program.command('killswitch').description('Manage the system VPN kill switch');

ksCmd
  .command('on')
  .description('Enable the kill switch')
  .action(async (options, cmd) => {
    if (!cmd.optsWithGlobals().json) printBanner();
    try {
      const { setKillSwitchConfig } = await import('./utils/kill-switch.js');
      setKillSwitchConfig(true);
      printSuccess('Kill switch enabled. All non-VPN traffic will be blocked when the tunnel is active.');
    } catch (err) {
      handleError('Command failed', err, cmd.optsWithGlobals().json);
    }
  });

ksCmd
  .command('off')
  .description('Disable the kill switch')
  .action(async (options, cmd) => {
    if (!cmd.optsWithGlobals().json) printBanner();
    try {
      const { setKillSwitchConfig } = await import('./utils/kill-switch.js');
      setKillSwitchConfig(false);
      printSuccess('Kill switch disabled.');
    } catch (err) {
      handleError('Command failed', err, cmd.optsWithGlobals().json);
    }
  });

const peerCmd = program.command('peer').description('Manage WireGuard/AmneziaWG client peers');

peerCmd
  .command('add <name>')
  .description('Generate and add a new peer config')
  .action(async (name, options, cmd) => {
    if (!cmd.optsWithGlobals().json) printBanner();
    try {
      const { peerAdd } = await import('./commands/peer.js');
      await peerAdd(name, cmd.optsWithGlobals());
    } catch (err) {
      handleError('Command failed', err, cmd.optsWithGlobals().json);
    }
  });

peerCmd
  .command('list')
  .description('List all active peer configurations')
  .action(async (options, cmd) => {
    if (!cmd.optsWithGlobals().json) printBanner();
    try {
      const { peerList } = await import('./commands/peer.js');
      await peerList(cmd.optsWithGlobals());
    } catch (err) {
      handleError('Command failed', err, cmd.optsWithGlobals().json);
    }
  });

peerCmd
  .command('remove <name>')
  .description('Revoke a peer from the server')
  .action(async (name, options, cmd) => {
    if (!cmd.optsWithGlobals().json) printBanner();
    try {
      const { peerRemove } = await import('./commands/peer.js');
      await peerRemove(name, cmd.optsWithGlobals());
    } catch (err) {
      handleError('Command failed', err, cmd.optsWithGlobals().json);
    }
  });

peerCmd
  .command('qr <name>')
  .description('Show peer configuration QR code')
  .action(async (name, options, cmd) => {
    try {
      const { peerQr } = await import('./commands/peer.js');
      await peerQr(name, cmd.optsWithGlobals());
    } catch (err) {
      handleError('Command failed', err, cmd.optsWithGlobals().json);
    }
  });

const bypassCmd = program.command('bypass').description('Manage split tunneling and bypass rules');

bypassCmd
  .command('add <target>')
  .description('Add a domain or IP subnet to bypass rules')
  .action(async (target, options, cmd) => {
    if (!cmd.optsWithGlobals().json) printBanner();
    try {
      const { bypassAdd } = await import('./commands/bypass.js');
      await bypassAdd(target, cmd.optsWithGlobals());
    } catch (err) {
      handleError('Command failed', err, cmd.optsWithGlobals().json);
    }
  });

bypassCmd
  .command('remove <target>')
  .description('Remove a domain or IP subnet from bypass rules')
  .action(async (target, options, cmd) => {
    if (!cmd.optsWithGlobals().json) printBanner();
    try {
      const { bypassRemove } = await import('./commands/bypass.js');
      await bypassRemove(target, cmd.optsWithGlobals());
    } catch (err) {
      handleError('Command failed', err, cmd.optsWithGlobals().json);
    }
  });

bypassCmd
  .command('list')
  .description('List all active bypass rules')
  .action(async (options, cmd) => {
    if (!cmd.optsWithGlobals().json) printBanner();
    try {
      const { bypassList } = await import('./commands/bypass.js');
      await bypassList(cmd.optsWithGlobals());
    } catch (err) {
      handleError('Command failed', err, cmd.optsWithGlobals().json);
    }
  });

program
  .command('import <file>')
  .description('Import a WireGuard or AmneziaWG configuration file (.conf)')
  .option('-a, --alias <name>', 'Custom alias name for the imported profile')
  .action(async (file, options, cmd) => {
    if (!cmd.optsWithGlobals().json) printBanner();
    try {
      const { configImport } = await import('./commands/import-export.js');
      await configImport(file, cmd.optsWithGlobals());
    } catch (err) {
      handleError('Command failed', err, cmd.optsWithGlobals().json);
    }
  });

program
  .command('export <alias>')
  .description('Export a profile configuration file or render QR code')
  .option('-o, --out <path>', 'Destination file path to write configuration to')
  .action(async (alias, options, cmd) => {
    if (!cmd.optsWithGlobals().json) printBanner();
    try {
      const { configExport } = await import('./commands/import-export.js');
      await configExport(alias, cmd.optsWithGlobals());
    } catch (err) {
      handleError('Command failed', err, cmd.optsWithGlobals().json);
    }
  });

const configCmd = program.command('config').description('Configure polaris settings');
configCmd
  .command('set <key> <value>')
  .description('Set a configuration setting (e.g. kill-switch true)')
  .action(async (key, value, options, cmd) => {
    const isJson = cmd.optsWithGlobals().json;
    if (!isJson) printBanner();
    try {
      if (key === 'kill-switch') {
        const val = value === 'true';
        const { setKillSwitchConfig } = await import('./utils/kill-switch.js');
        setKillSwitchConfig(val);
        const { printSuccess } = await import('./utils/display.js');
        if (!isJson) {
          printSuccess(`Set config 'kill-switch' to ${val}`);
        } else {
          console.log(JSON.stringify({ success: true, key, value: val }));
        }
      } else {
        throw new Error(`Unknown config key '${key}'`);
      }
    } catch (err) {
      if (!isJson) printError('Command failed', err);
      process.exit(1);
    }
  });

program
  .command('server')
  .description('Manage the local REST API server')
  .command('start')
  .description('Start the local REST API server')
  .option('-p, --port <port>', 'Port to listen on', '7070')
  .action(async (options) => {
    const { serverStart } = await import('./commands/server.js');
    await serverStart({ ...options, json: willPrintJson() });
  });

program
  .command('monitor')
  .description('Live bandwidth monitor for WireGuard/AmneziaWG tunnels')
  .action(async (options, cmd) => {
    const run = (await import('./commands/monitor.js')).default;
    await run(cmd.optsWithGlobals());
  });

if (process.argv.length === 2) {
  import('./commands/tui.js').then(m => m.default()).catch(err => {
    printError('Fatal error', err);
    process.exit(1);
  });
} else {
  program.parseAsync(process.argv).catch(err => {
    if (!willPrintJson()) printError('Fatal error', err);
    process.exit(1);
  });
}
