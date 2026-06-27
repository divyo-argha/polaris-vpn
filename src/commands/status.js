import { getTunnelInfo } from '../tunnel/ssh.js';
import { getProxiedIp, getPublicIp } from '../net/ip.js';
import { createTable, createSpinner, printError } from '../ui/display.js';
import chalk from 'chalk';

export default async (options) => {
  const isJson = options.json;
  const info = getTunnelInfo();
  
  if (!info) {
    if (isJson) {
      console.log(JSON.stringify({ status: 'down' }));
    } else {
      console.log(chalk.red.bold('\n● Tunnel is DOWN\n'));
    }
    return;
  }
  
  let currentIp = 'Unknown';
  const spinner = isJson ? null : createSpinner('Checking proxy status...').start();
  
  try {
    currentIp = await getProxiedIp(info.port);
    if (spinner) spinner.stop();
    
    if (isJson) {
      const uptimeMs = Date.now() - new Date(info.startTime).getTime();
      console.log(JSON.stringify({
        status: 'up',
        server: info.server,
        port: info.port,
        pid: info.pid,
        ip: currentIp,
        uptimeMs
      }));
    } else {
      console.log(chalk.green.bold('\n● Tunnel is UP\n'));
      
      const uptimeMin = Math.floor((Date.now() - new Date(info.startTime).getTime()) / 60000);
      const table = createTable(['Property', 'Value']);
      
      table.push(
        ['Status', chalk.green('Connected')],
        ['Server', info.server],
        ['Proxy', `socks5://127.0.0.1:${info.port}`],
        ['Current IP', chalk.cyan(currentIp)],
        ['Uptime', `${uptimeMin} minutes`],
        ['PID', info.pid.toString()]
      );
      
      console.log(table.toString());
      console.log('');
    }
  } catch (err) {
    if (spinner) spinner.stop();
    if (isJson) {
      console.log(JSON.stringify({ status: 'error', error: err.message }));
    } else {
      printError('Tunnel process is running, but proxy is unresponsive', err);
    }
    process.exitCode = 1;
  }
};
