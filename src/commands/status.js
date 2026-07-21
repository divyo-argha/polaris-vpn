import { getActiveTunnel } from '../core/tunnel-service.js';
import { getProxiedIp, getPublicIp } from '../net/ip-check.js';
import { createTable, createSpinner, printError } from '../utils/display.js';
import chalk from 'chalk';
import fetch from 'node-fetch';
import { spawnSync } from 'child_process';
import os from 'os';

const pingServer = (ip) => {
  const isWin = os.platform() === 'win32';
  const args = isWin ? ['-n', '1', '-w', '2000', ip] : ['-c', '1', '-W', '2', ip];
  const res = spawnSync('ping', args, { encoding: 'utf-8' });
  if (res.status === 0) {
    if (isWin) {
      const match = res.stdout.match(/Average = (\d+)ms/);
      if (match) return `${match[1]} ms`;
    } else {
      const match = res.stdout.match(/time=([\d.]+)\s*ms/);
      if (match) return `${match[1]} ms`;
    }
  }
  return 'Timeout';
};

const getGeoIp = async (ip) => {
  try {
    const res = await fetch(`http://ip-api.com/json/${ip}`);
    const data = await res.json();
    if (data.status === 'success') {
      return `${data.city}, ${data.country} (${data.isp})`;
    }
  } catch (err) {}
  return 'Unknown';
};

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getWgStats = (isAwg = false) => {
  const cmd = isAwg ? 'awg' : 'wg';
  let dumpRes = spawnSync('sudo', [cmd, 'show', 'all', 'dump'], { encoding: 'utf-8' });
  if (dumpRes.status !== 0 && isAwg) {
    dumpRes = spawnSync('sudo', ['wg', 'show', 'all', 'dump'], { encoding: 'utf-8' });
  }
  if (dumpRes.status !== 0) return null;
  const lines = dumpRes.stdout.trim().split('\n');
  if (lines.length <= 1) return null;
  
  let totalRx = 0;
  let totalTx = 0;
  for (let i = 1; i < lines.length; i++) {
    const peerInfo = lines[i].split('\t');
    totalRx += parseInt(peerInfo[6], 10) || 0;
    totalTx += parseInt(peerInfo[7], 10) || 0;
  }
  return { totalRx, totalTx };
};

export default async (options) => {
  const isJson = options.json;
  const isFull = options.full;
  const info = getActiveTunnel();
  
  if (!info) {
    if (isJson) {
      console.log(JSON.stringify({ status: 'down' }));
    } else {
      console.log(chalk.red.bold('\n● Tunnel is DOWN\n'));
    }
    return;
  }
  
  let currentIp = 'Unknown';
  const isSystemWide = info.mode === 'wireguard' || info.mode === 'amneziawg';
  const spinner = isJson ? null : createSpinner(isSystemWide ? 'Checking public IP...' : 'Checking proxy status...').start();
  
  try {
    currentIp = isSystemWide ? await getPublicIp() : await getProxiedIp(info.port);
    if (spinner) spinner.stop();
    
    let geo = 'N/A';
    let latency = 'N/A';
    let dataUsage = 'N/A';

    if (isFull) {
      if (spinner) {
        spinner.text = 'Fetching full health data...';
        spinner.start();
      }
      
      const serverIp = info.server.split('@').pop();
      latency = pingServer(serverIp);
      geo = await getGeoIp(currentIp);

      if (isSystemWide) {
        const stats = getWgStats(info.mode === 'amneziawg');
        if (stats) {
          dataUsage = `${formatBytes(stats.totalRx)} / ${formatBytes(stats.totalTx)}`;
        }
      }
      
      if (spinner) spinner.stop();
    }
    
    if (isJson) {
      const uptimeMs = Date.now() - new Date(info.startTime).getTime();
      const payload = {
        status: 'up',
        server: info.server,
        port: info.port,
        pid: info.pid,
        mode: info.mode || 'ssh',
        ip: currentIp,
        uptimeMs
      };
      if (isFull) {
        payload.geo = geo;
        payload.latency = latency;
        payload.dataUsage = dataUsage;
      }
      console.log(JSON.stringify(payload));
    } else {
      console.log(chalk.green.bold('\n● Tunnel is UP\n'));
      
      const uptimeMin = Math.floor((Date.now() - new Date(info.startTime).getTime()) / 60000);
      const table = createTable(['Property', 'Value']);
      
      table.push(
        ['Status', chalk.green('Connected')],
        ['Mode', (info.mode || 'ssh').toUpperCase()],
        ['Server', info.server]
      );

      if (isSystemWide) {
        table.push(['Connection', chalk.cyan('System-wide (All OS traffic)')]);
      } else {
        table.push(['Proxy', `socks5://127.0.0.1:${info.port}`]);
      }

      table.push(
        ['Current IP', chalk.cyan(currentIp)],
        ['Uptime', `${uptimeMin} minutes`],
        ['PID', info.pid.toString()]
      );

      if (isFull) {
        table.push(
          ['Geo Location', geo],
          ['Latency (Ping)', latency],
          ['Data (Rx/Tx)', dataUsage]
        );
      }
      
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
