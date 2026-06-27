#!/usr/bin/env node
import { Command } from 'commander';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { printBanner, printError } from './ui/display.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkg = JSON.parse(readFileSync(path.join(__dirname, '..', 'package.json'), 'utf-8'));

const program = new Command();

program
  .name('polaris')
  .description(pkg.description)
  .version(pkg.version)
  .option('--json', 'Output results in JSON format');

// Helper to check if we should print the banner
const willPrintJson = () => process.argv.includes('--json');

program
  .command('start')
  .description('Start the encrypted SSH tunnel')
  .option('-s, --server <user@host>', 'SSH server to connect to')
  .option('-p, --port <number>', 'Local SOCKS5 port to bind', '1080')
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

program.parseAsync(process.argv).catch(err => {
  if (!willPrintJson()) printError('Fatal error', err);
  process.exit(1);
});
