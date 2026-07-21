import net from 'net';
import { spawnSync } from 'child_process';
import os from 'os';
import { getProfiles } from './profile-service.js';

export const measurePing = (host) => {
  const isWin = os.platform() === 'win32';
  const args = isWin ? ['-n', '1', '-w', '1500', host] : ['-c', '1', '-W', '2', host];
  const start = Date.now();
  const res = spawnSync('ping', args, { encoding: 'utf-8' });
  const duration = Date.now() - start;

  if (res.status === 0) {
    const match = res.stdout.match(isWin ? /Average = (\d+)ms/ : /time=([\d.]+)\s*ms/);
    if (match) return parseFloat(match[1]);
    return duration;
  }
  return null;
};

export const measureTcpHandshake = (host, port = 22, timeoutMs = 2000) => {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      const elapsed = Date.now() - start;
      socket.destroy();
      resolve(elapsed);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(null);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(null);
    });

    socket.connect(port, host);
  });
};

export const benchmarkServer = async (alias, serverStr) => {
  const host = serverStr.includes('@') ? serverStr.split('@')[1] : serverStr;
  const ping = measurePing(host);
  const tcpSsh = await measureTcpHandshake(host, 22);
  const tcpTls = await measureTcpHandshake(host, 8443);

  const score = ping !== null ? ping : (tcpSsh !== null ? tcpSsh : (tcpTls !== null ? tcpTls : 9999));

  return {
    alias,
    server: serverStr,
    host,
    ping: ping !== null ? `${ping.toFixed(1)} ms` : 'Timeout',
    tcpSsh: tcpSsh !== null ? `${tcpSsh} ms` : 'Timeout',
    tcpTls: tcpTls !== null ? `${tcpTls} ms` : 'Timeout',
    score
  };
};

export const benchmarkAllProfiles = async () => {
  const { profiles } = getProfiles();
  const aliases = Object.keys(profiles);
  if (aliases.length === 0) return [];

  const results = [];
  for (const alias of aliases) {
    const res = await benchmarkServer(alias, profiles[alias]);
    results.push(res);
  }

  results.sort((a, b) => a.score - b.score);
  return results;
};
