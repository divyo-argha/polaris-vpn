import chalk from 'chalk';
import { getActiveTunnel } from '../core/tunnel-service.js';
import { createTable, printError } from '../utils/display.js';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { CONFIG_DIR } from '../utils/config.js';

const getWgStats = () => {
  const confPathAwg = path.join(CONFIG_DIR, 'wg', 'awg0.conf');
  const showCmd = fs.existsSync(confPathAwg) ? 'awg' : 'wg';
  
  const dumpRes = spawnSync('sudo', [showCmd, 'show', 'all', 'dump'], { encoding: 'utf-8' });
  if (dumpRes.status !== 0) return null;

  const lines = dumpRes.stdout.trim().split('\n');
  if (lines.length <= 1) return null;

  const peers = [];
  let totalRx = 0;
  let totalTx = 0;

  for (let i = 1; i < lines.length; i++) {
    const peerInfo = lines[i].split('\t');
    const rx = parseInt(peerInfo[6], 10) || 0;
    const tx = parseInt(peerInfo[7], 10) || 0;
    totalRx += rx;
    totalTx += tx;
    peers.push({
      pubKey: peerInfo[1].substring(0, 8) + '...',
      endpoint: peerInfo[4],
      rx,
      tx
    });
  }

  return { peers, totalRx, totalTx };
};

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default async (options) => {
  const isJson = options.json;
  const info = getActiveTunnel();

  if (!info || info.mode !== 'wireguard') {
    if (isJson) {
      console.log(JSON.stringify({ error: 'WireGuard tunnel is not active' }));
    } else {
      printError('Monitor requires an active WireGuard or AmneziaWG tunnel.');
    }
    process.exitCode = 1;
    return;
  }

  if (isJson) {
    console.log(JSON.stringify(getWgStats()));
    return;
  }

  let prevRx = 0;
  let prevTx = 0;
  let hasInit = false;

  console.clear();
  console.log(chalk.cyan.bold('\n● Polaris Live Bandwidth Monitor\n'));
  console.log(chalk.dim('Press Ctrl+C to exit.\n'));

  setInterval(() => {
    const stats = getWgStats();
    if (!stats) return;

    if (!hasInit) {
      prevRx = stats.totalRx;
      prevTx = stats.totalTx;
      hasInit = true;
      return;
    }

    const rxSpeed = stats.totalRx - prevRx;
    const txSpeed = stats.totalTx - prevTx;

    prevRx = stats.totalRx;
    prevTx = stats.totalTx;

    console.clear();
    console.log(chalk.cyan.bold('\n● Polaris Live Bandwidth Monitor\n'));
    console.log(chalk.dim('Press Ctrl+C to exit.\n'));

    const table = createTable(['Metric', 'Value']);
    table.push(
      ['Download Speed', chalk.green(`${formatBytes(rxSpeed)}/s`)],
      ['Upload Speed', chalk.green(`${formatBytes(txSpeed)}/s`)],
      ['Total Data Received', formatBytes(stats.totalRx)],
      ['Total Data Sent', formatBytes(stats.totalTx)]
    );
    console.log(table.toString());

    if (stats.peers.length > 0) {
      console.log(chalk.bold('\nActive Peers:'));
      const peerTable = createTable(['Peer', 'Endpoint', 'Received', 'Sent']);
      for (const peer of stats.peers) {
        peerTable.push([
          peer.pubKey, 
          peer.endpoint, 
          formatBytes(peer.rx), 
          formatBytes(peer.tx)
        ]);
      }
      console.log(peerTable.toString());
    }

  }, 1000);
};
