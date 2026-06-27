import chalk from 'chalk';
import Conf from 'conf';
import { printError, printSuccess, printInfo, createSpinner, printWarning } from '../ui/display.js';
import { getPublicIp, getProxiedIp } from '../net/ip.js';
import { spawnSSH, waitForSocks, saveTunnelInfo, getTunnelInfo } from '../tunnel/ssh.js';

const config = new Conf({ projectName: 'polaris' });

export default async (options) => {
  const isJson = options.json;
  let server = options.server;
  const port = parseInt(options.port || '1080', 10);

  if (!server) {
    // Try to load default from profile if not provided
    const profiles = config.get('servers', {});
    const activeAlias = config.get('activeServer');
    if (activeAlias && profiles[activeAlias]) {
      server = profiles[activeAlias];
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
  const info = getTunnelInfo();
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
      spinner.text = 'Starting SSH SOCKS5 tunnel...';
      spinner.start();
    }
    
    const pid = spawnSSH(server, port);
    saveTunnelInfo(pid, server, port);
    
    if (!isJson) {
      spinner.text = 'Waiting for proxy to become ready...';
    }
    
    await waitForSocks(port);
    
    if (!isJson) {
      spinner.text = 'Verifying IP through proxy...';
    }
    
    const newIp = await getProxiedIp(port);
    
    if (!isJson) {
      spinner.stop();
      printSuccess(`Tunnel established successfully to ${server}`);
      console.log(`\n  ${chalk.dim('Old IP:')} ${chalk.red(oldIp)}`);
      console.log(`  ${chalk.dim('New IP:')} ${chalk.green(newIp)}`);
      console.log(`  ${chalk.dim('Proxy :')} ${chalk.cyan(`socks5://127.0.0.1:${port}`)}`);
      
      console.log(chalk.dim('\nTunnel is running in the background. Leave this terminal or close it, it will stay alive.'));
      console.log(chalk.dim('Run "polaris status" to check, or "polaris stop" to end.'));
    } else {
      console.log(JSON.stringify({ success: true, oldIp, newIp, proxy: `socks5://127.0.0.1:${port}`, pid }));
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
