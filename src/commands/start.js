import chalk from 'chalk';
import tls from 'tls';
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { printSuccess, createSpinner, printInfo, promptSelection, printBox } from '../utils/display.js';
import { handleError } from '../utils/error-handler.js';
import { getPublicIp, getProxiedIp } from '../net/ip-check.js';
import { getProfiles } from '../core/profile-service.js';
import { getActiveTunnel, startTunnel } from '../core/tunnel-service.js';
import { CONFIG_DIR } from '../utils/config.js';

const WG_CONF = path.join(CONFIG_DIR, 'wg', 'wg0.conf');

const detectTlsServer = (host, port = 8443) => {
  return new Promise((resolve) => {
    const socket = tls.connect({
      host,
      port,
      rejectUnauthorized: false,
      timeout: 3000
    }, () => {
      socket.destroy();
      resolve(true);
    });
    
    socket.on('error', () => {
      resolve(false);
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
};

const hasWgQuick = () => {
  try {
    const res = spawnSync('which', ['wg-quick'], { encoding: 'utf-8' });
    return res.status === 0;
  } catch (e) {
    return false;
  }
};

export default async (options) => {
  const isJson = options.json;
  let server = options.server;
  const port = parseInt(options.port || '1080', 10);
  const requestedMode = options.mode || 'auto';

  if (!server) {
    const active = config.get('activeProfile');
    const profiles = config.get('profiles') || {};
    
    if (active && profiles[active]) {
      server = profiles[active];
    } else {
      if (isJson) {
        handleError('No server specified.', null, isJson);
        return;
      }
      
      const profileNames = Object.keys(profiles);
      if (profileNames.length === 0) {
        handleError('No server specified and no saved profiles found. Use --server <user@host>', null, isJson);
        return;
      }

      printInfo('No server specified. Select a saved profile to connect to:');
      const choice = await promptSelection('Select Profile:', profileNames.map(p => ({
        name: `${p} (${profiles[p]})`,
        value: profiles[p]
      })));
      
      server = choice;
    }
  }

  // Check if already running
  const info = getActiveTunnel();
  if (info) {
    handleError(`Tunnel is already running connected to ${info.server}. Run "polaris stop" first.`, null, isJson);
    return;
  }

  let oldIp;
  const spinner = isJson ? null : createSpinner('Fetching current IP...').start();
  
  try {
    oldIp = await getPublicIp();
    if (!isJson) {
      spinner.succeed(`Current IP: ${chalk.cyan(oldIp)}`);
    }

    const hostPart = server.includes('@') ? server.split('@')[1] : server;
    let actualMode = requestedMode;

    const AWG_CONF = path.join(CONFIG_DIR, 'wg', 'awg0.conf');

    const hasAwgQuick = () => {
      try {
        const res = spawnSync('which', ['awg-quick'], { encoding: 'utf-8' });
        return res.status === 0;
      } catch (e) {
        return false;
      }
    };

    if (requestedMode === 'auto') {
      if (fs.existsSync(AWG_CONF) && hasAwgQuick()) {
        actualMode = 'amneziawg';
      } else if (fs.existsSync(WG_CONF) && hasWgQuick()) {
        actualMode = 'wireguard';
      } else {
        if (!isJson) {
          spinner.text = 'Checking server for TLS support...';
          spinner.start();
        }
        const hasTls = await detectTlsServer(hostPart, 8443);
        if (hasTls) {
          actualMode = 'tls';
        } else {
          actualMode = 'ssh';
          if (!isJson) {
            spinner.info('TLS server not detected. Falling back to SSH mode...');
          }
        }
      }
    }

    if (!isJson) {
      spinner.text = `Starting ${actualMode.toUpperCase()} tunnel...`;
      spinner.start();
    }

    const res = await startTunnel(server, port, actualMode, isJson);
    
    if (actualMode === 'wireguard' || actualMode === 'amneziawg') {
      if (!isJson) {
        spinner.text = 'Waiting for interface to configure...';
      }
      await new Promise(r => setTimeout(r, 2000));
      
      if (!isJson) {
        spinner.text = 'Verifying system-wide IP...';
      }
      const newIp = await getPublicIp();
      
      if (!isJson) {
        spinner.stop();
        printBox('Tunnel Connected 🚀', `Server: ${server}\nMode: ${actualMode.toUpperCase()}\nStatus: System-wide (All OS traffic)\nOld IP: ${oldIp}\nNew IP: ${newIp}`, 'success');
      } else {
        console.log(JSON.stringify({ success: true, oldIp, newIp, mode: actualMode, pid: res.pid }));
      }
    } else {
      if (!isJson) {
        spinner.text = 'Verifying IP through proxy...';
      }
      const newIp = await getProxiedIp(port);
      
      if (!isJson) {
        spinner.stop();
        printBox('Tunnel Connected 🚀', `Server: ${server}\nMode: ${actualMode.toUpperCase()}\nProxy: socks5://127.0.0.1:${port}\nOld IP: ${oldIp}\nNew IP: ${newIp}`, 'success');
      } else {
        console.log(JSON.stringify({ success: true, oldIp, newIp, proxy: `socks5://127.0.0.1:${port}`, pid: res.pid, mode: actualMode }));
      }
    }

  } catch (err) {
    if (!isJson && spinner) spinner.stop();
    handleError('Failed to start tunnel', err, isJson);
  }
};
