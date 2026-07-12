#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import updateNotifier from 'update-notifier';
import { spawnSync } from 'child_process';
import { printBanner, printError, printSuccess } from './utils/display.js';
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
  .description('Start the encrypted SSH, TLS or WireGuard tunnel')
  .option('-s, --server <user@host>', 'SSH/TLS/WireGuard server to connect to')
  .option('-p, --port <number>', 'Local SOCKS5 port to bind', '1080')
  .option('-m, --mode <type>', 'Tunnel mode: ssh, tls, wireguard or auto', 'auto')
  .action(async (options, cmd) => {
    if (!cmd.optsWithGlobals().json) printBanner();
    try {
      const run = (await import('./commands/start.js')).default;
      await run(cmd.optsWithGlobals());
    } catch (err) {
      if (!cmd.optsWithGlobals().json) printError('Command failed', err);
      process.exit(1);
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
      if (!cmd.optsWithGlobals().json) printError('Command failed', err);
      process.exit(1);
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
      if (!cmd.optsWithGlobals().json) printError('Command failed', err);
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
      if (!cmd.optsWithGlobals().json) printError('Command failed', err);
      process.exit(1);
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
      if (!cmd.optsWithGlobals().json) printError('Command failed', err);
      process.exit(1);
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
      if (!cmd.optsWithGlobals().json) printError('Command failed', err);
      process.exit(1);
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
      if (!cmd.optsWithGlobals().json) printError('Command failed', err);
      process.exit(1);
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
      if (!cmd.optsWithGlobals().json) printError('Command failed', err);
      process.exit(1);
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
      if (!cmd.optsWithGlobals().json) printError('Command failed', err);
      process.exit(1);
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
      if (!cmd.optsWithGlobals().json) printError('Command failed', err);
      process.exit(1);
    }
  });

program
  .command('deploy')
  .description('Provision a fresh Ubuntu server as a WireGuard server')
  .requiredOption('-s, --server <user@host>', 'SSH server to configure')
  .option('-i, --identity <path>', 'SSH private key file path')
  .option('-p, --password <password>', 'SSH password (alternative to identity)')
  .action(async (options, cmd) => {
    if (!cmd.optsWithGlobals().json) printBanner();
    try {
      const run = (await import('./commands/deploy.js')).default;
      await run(cmd.optsWithGlobals());
    } catch (err) {
      if (!cmd.optsWithGlobals().json) printError('Command failed', err);
      process.exit(1);
    }
  });

const peerCmd = program.command('peer').description('Manage WireGuard client peers');

peerCmd
  .command('add <name>')
  .description('Generate and add a new peer config')
  .action(async (name, options, cmd) => {
    if (!cmd.optsWithGlobals().json) printBanner();
    try {
      const { peerAdd } = await import('./commands/peer.js');
      await peerAdd(name, cmd.optsWithGlobals());
    } catch (err) {
      if (!cmd.optsWithGlobals().json) printError('Command failed', err);
      process.exit(1);
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
      if (!cmd.optsWithGlobals().json) printError('Command failed', err);
      process.exit(1);
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
      if (!cmd.optsWithGlobals().json) printError('Command failed', err);
      process.exit(1);
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
      if (!cmd.optsWithGlobals().json) printError('Command failed', err);
      process.exit(1);
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

program.parseAsync(process.argv).catch(err => {
  if (!willPrintJson()) printError('Fatal error', err);
  process.exit(1);
});
