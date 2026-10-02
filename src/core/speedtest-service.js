import fetch from 'node-fetch';
import { getPublicIp } from '../net/ip-check.js';
import { getActiveTunnel } from './tunnel-service.js';
import { measurePing } from './benchmark-service.js';

const SPEEDTEST_ENDPOINTS = [
  'https://speed.cloudflare.com/__down?bytes=10485760', // 10 MB Cloudflare CDN
  'https://proof.ovh.net/files/10Mb.dat'
];

export const runSpeedTest = async (onProgress = () => {}) => {
  const active = getActiveTunnel();
  const currentIp = await getPublicIp().catch(() => 'Unknown');

  onProgress('Measuring ping and latency...');
  const pingTimes = [];
  for (const host of ['1.1.1.1', '8.8.8.8']) {
    const p = await measurePing(host);
    if (p !== null) pingTimes.push(p);
  }
  const avgPing = pingTimes.length > 0 
    ? Math.round(pingTimes.reduce((a, b) => a + b, 0) / pingTimes.length) 
    : 0;

  onProgress('Testing download throughput (10 MB payload)...');
  let downloadSpeedMbps = 0;
  let downloadedBytes = 0;
  let durationSec = 0;

  for (const url of SPEEDTEST_ENDPOINTS) {
    try {
      const startTime = Date.now();
      const res = await fetch(url, { timeout: 15000 });
      if (!res.ok) continue;

      const buffer = await res.arrayBuffer();
      downloadedBytes = buffer.byteLength;
      durationSec = (Date.now() - startTime) / 1000;

      if (durationSec > 0 && downloadedBytes > 0) {
        const bits = downloadedBytes * 8;
        downloadSpeedMbps = Number((bits / durationSec / (1024 * 1024)).toFixed(2));
        break;
      }
    } catch (err) {
      // Fallback to next endpoint
    }
  }

  let rating = 'Standard';
  if (downloadSpeedMbps > 100) rating = 'Ultra Fast (4K HDR / Gigabit)';
  else if (downloadSpeedMbps > 40) rating = 'Fast (4K Streaming / Low Latency)';
  else if (downloadSpeedMbps > 15) rating = 'Good (HD Video / Web Browsing)';
  else if (downloadSpeedMbps > 5) rating = 'Moderate';

  return {
    publicIp: currentIp,
    tunnelActive: Boolean(active),
    tunnelMode: active ? active.mode.toUpperCase() : 'DIRECT (NO VPN)',
    server: active ? active.server : 'N/A',
    pingMs: avgPing,
    downloadSpeedMbps,
    downloadSpeedMBps: Number((downloadSpeedMbps / 8).toFixed(2)),
    rating,
    timestamp: new Date().toISOString()
  };
};
