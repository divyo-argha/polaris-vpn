import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { CONFIG_DIR } from '../utils/config.js';
import { createSpinner, printSuccess, printError, printInfo } from '../utils/display.js';
import { logEvent } from '../utils/logger.js';

const DEPLOY_JSON = path.join(CONFIG_DIR, 'wg', 'deploy.json');

const getDefaultPrivateKey = () => {
  const keys = ['id_rsa', 'id_ed25519', 'id_ecdsa', 'id_dsa'];
  for (const k of keys) {
    const p = path.join(os.homedir(), '.ssh', k);
    if (fs.existsSync(p)) return fs.readFileSync(p);
  }
  return null;
};

export default async (options) => {
  const isJson = options.json;

  // Resolve server info — CLI option overrides deploy.json
  let serverStr = options.server;
  let mode = options.mode;

  if (!serverStr) {
    if (!fs.existsSync(DEPLOY_JSON)) {
      const msg = 'No deployed server found. Use --server <user@host> or deploy first with "polaris deploy".';
      if (isJson) console.log(JSON.stringify({ error: msg }));
      else printError(msg);
      process.exitCode = 1;
      return;
    }
    const deployInfo = JSON.parse(fs.readFileSync(DEPLOY_JSON, 'utf-8'));
    serverStr = deployInfo.server;
    mode = mode || deployInfo.mode || 'wireguard';
  }

  const parts = serverStr.split('@');
  const username = parts.length > 1 ? parts[0] : 'ubuntu';
  const host = parts.length > 1 ? parts[1] : parts[0];
  const isAwg = (mode || 'wireguard') === 'amneziawg';

  let privateKey = null;
  if (options.identity) {
    if (!fs.existsSync(options.identity)) {
      const msg = `SSH identity file not found: ${options.identity}`;
      if (isJson) console.log(JSON.stringify({ error: msg }));
      else printError(msg);
      process.exitCode = 1;
      return;
    }
    privateKey = fs.readFileSync(options.identity);
  } else {
    privateKey = getDefaultPrivateKey();
  }

  if (!privateKey) {
    const msg = 'No SSH private key found. Configure ~/.ssh/id_rsa or use --identity <path>.';
    if (isJson) console.log(JSON.stringify({ error: msg }));
    else printError(msg);
    process.exitCode = 1;
    return;
  }

  if (!isJson) printInfo(`Connecting to ${serverStr} to update VPN packages...`);

  const spinner = isJson ? null : createSpinner('Connecting...').start();

  const conn = new Client();

  try {
    await new Promise((resolve, reject) => {
      conn.on('ready', () => {
        const pkgName = isAwg ? 'amneziawg-dkms amneziawg-tools wireguard' : 'wireguard wireguard-tools';
        const cmd = `sudo apt-get update -y && sudo DEBIAN_FRONTEND=noninteractive apt-get upgrade -y ${pkgName} unbound fail2ban`;

        if (spinner) spinner.text = 'Running package update on server (this may take a minute)...';

        conn.exec(cmd, (err, stream) => {
          if (err) { conn.end(); return reject(err); }

          stream.on('data', (chunk) => {
            const line = chunk.toString('utf-8').trim();
            if (line && !isJson) {
              if (spinner) spinner.stop();
              console.log(chalk_dim(line));
              if (spinner) spinner.start();
            }
          });

          stream.stderr.on('data', (chunk) => {
            // apt writes normal progress to stderr — only surface real errors
            const line = chunk.toString('utf-8').trim();
            if (line && line.toLowerCase().includes('err:') && !isJson) {
              console.error(line);
            }
          });

          stream.on('close', (code) => {
            conn.end();
            if (code === 0) resolve();
            else reject(new Error(`Update command exited with code ${code}`));
          });
        });
      }).on('error', reject);

      conn.connect({ host, port: 22, username, privateKey, readyTimeout: 15000 });
    });

    if (spinner) spinner.stop();

    logEvent('INFO', `Remote server packages updated on ${serverStr}`);

    if (isJson) {
      console.log(JSON.stringify({ success: true, server: serverStr, message: 'VPN packages updated successfully.' }));
    } else {
      printSuccess(`VPN packages updated successfully on ${serverStr}.`);
    }
  } catch (err) {
    if (spinner) spinner.stop();
    logEvent('ERROR', `update-server failed: ${err.message}`, { server: serverStr });
    if (isJson) {
      console.log(JSON.stringify({ error: err.message }));
    } else {
      printError('Failed to update server packages', err);
    }
    process.exitCode = 1;
  }
};

// Lazy import chalk for inline output (avoids top-level await)
const chalk_dim = (str) => `\x1b[2m${str}\x1b[0m`;
