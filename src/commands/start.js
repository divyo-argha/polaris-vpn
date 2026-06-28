import chalk from 'chalk';
import tls from 'tls';
import { printError, printSuccess, createSpinner } from '../utils/display.js';
import { getPublicIp, getProxiedIp } from '../net/ip-check.js';
import { getProfiles } from '../core/profile-service.js';
import { getActiveTunnel, startTunnel } from '../core/tunnel-service.js';

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

export default async (options) => {
  const isJson = options.json;
  let server = options.server;
  const port = parseInt(options.port || '1080', 10);
  const requestedMode = options.mode || 'auto';

  if (!server) {
    const { profiles, active } = getProfiles();
    if (active && profiles[active]) {
      server = profiles[active];
    } else {
      if (isJson) {
        console.log(JSON.stringify({ error: 'No server specified' }));
      } else {
        printError('No server specified. Use --server <user@host> or set an active profile with "polaris use".');
      }
      process.exitCode = 1;
      return;
    }
  }

  // Check if already running
  const info = getActiveTunnel();
  if (info) {
    if (isJson) {
      console.log(JSON.stringify({ error: 'Tunnel already running', pid: info.pid }));
    } else {
      printError(`Tunnel is already running (PID: ${info.pid}) connected to ${info.server}. Run "polaris stop" first.`);
    }
    process.exitCode = 1;
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

    if (requestedMode === 'auto') {
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

    if (!isJson) {
      spinner.text = `Starting ${actualMode.toUpperCase()} tunnel...`;
      spinner.start();
    }

    const res = await startTunnel(server, port, actualMode);
    
    if (!isJson) {
      spinner.text = 'Verifying IP through proxy...';
    }
    
    const newIp = await getProxiedIp(port);
    
    if (!isJson) {
      spinner.stop();
      printSuccess(`Tunnel established successfully to ${server} (${actualMode.toUpperCase()} mode)`);
      console.log(`\n  ${chalk.dim('Old IP:')} ${chalk.red(oldIp)}`);
      console.log(`  ${chalk.dim('New IP:')} ${chalk.green(newIp)}`);
      console.log(`  ${chalk.dim('Proxy :')} ${chalk.cyan(`socks5://127.0.0.1:${port}`)}`);
      
      console.log(chalk.dim('\nTunnel is running in the background. Leave this terminal or close it, it will stay alive.'));
      console.log(chalk.dim('Run "polaris status" to check, or "polaris stop" to end.'));
    } else {
      console.log(JSON.stringify({ success: true, oldIp, newIp, proxy: `socks5://127.0.0.1:${port}`, pid: res.pid, mode: actualMode }));
    }

  } catch (err) {
    if (!isJson && spinner) spinner.stop();
    if (isJson) {
      console.log(JSON.stringify({ error: err.message }));
    } else {
      printError('Failed to start tunnel', err);
    }
    process.exitCode = 1;
  }
};
