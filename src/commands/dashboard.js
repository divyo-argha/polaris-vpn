import blessed from 'blessed';
import contrib from 'blessed-contrib';
import { getActiveTunnel } from '../core/tunnel-service.js';
import { getProxiedIp } from '../net/ip-check.js';
import fetch from 'node-fetch';
import { spawnSync } from 'child_process';
import os from 'os';

// ─── DESIGN SYSTEM (Nord Theme) ────────────────────────────────────────────────
const D = {
  accent:     '#88c0d0',
  accentDim:  '#81a1c1',
  success:    '#a3be8c',
  danger:     '#bf616a',
  warning:    '#ebcb8b',
  purple:     '#b48ead',
  muted:      '#d8dee9',
  text:       '#e5e9f0',
  bright:     '#eceff4',
  bg:         '#2e3440',
  bgSidebar:  '#3b4252',
  bgSel:      '#4c566a',
  sep:        '#434c5e',
};

const t = (hex, s) => `{${hex}-fg}${s}{/}`;
const b = (s)      => `{bold}${s}{/bold}`;

// ─── UTILS ──────────────────────────────────────────────────────────────────
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
      return { 
        text: `${data.city}, ${data.country}`,
        lat: data.lat,
        lon: data.lon,
        isp: data.isp
      };
    }
  } catch (err) {}
  return null;
}

const formatBytes = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getWgStats = () => {
  const dumpRes = spawnSync('sudo', ['wg', 'show', 'all', 'dump'], { encoding: 'utf-8' });
  if (dumpRes.status !== 0) return null;
  const lines = dumpRes.stdout.trim().split('\n');
  if (lines.length <= 1) return null;
  
  let totalRx = 0;
  let totalTx = 0;
  const peers = [];
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
  return { totalRx, totalTx, peers };
};

// ─── DASHBOARD APP ──────────────────────────────────────────────────────────
export default async () => {
  const info = getActiveTunnel();
  
  if (!info) {
    console.error('Tunnel is down. Start the tunnel first to use the dashboard.');
    return;
  }

  const screen = blessed.screen({
    smartCSR: true,
    title: 'Polaris VPN Dashboard',
    fullUnicode: true
  });

  const grid = new contrib.grid({ rows: 12, cols: 12, screen: screen });

  // 1. Header Box (Status, IP, Uptime)
  const headerBox = grid.set(0, 0, 3, 4, blessed.box, {
    label: ` ${t(D.accent, 'Tunnel Status')} `,
    content: 'Loading...',
    tags: true,
    style: { bg: D.bg, fg: D.text, border: { fg: D.accentDim, bg: D.bg } },
    border: { type: 'line' }
  });

  // 2. Line Chart (Bandwidth)
  const lineChart = grid.set(0, 4, 6, 8, contrib.line, {
    label: ` ${t(D.accent, 'Bandwidth (Bytes/s)')} `,
    showLegend: true,
    legend: { width: 12 },
    style: { baseline: D.sep, bg: D.bg, border: { fg: D.accentDim, bg: D.bg }, text: D.text },
    xLabelPadding: 3,
    xPadding: 5
  });

  // 3. Map (GeoIP)
  const mapWidget = grid.set(3, 0, 9, 7, contrib.map, {
    label: ` ${t(D.accent, 'Server Location')} `,
    style: { shapeColor: D.accentDim, bg: D.bg, border: { fg: D.accentDim, bg: D.bg } }
  });

  // 4. Peers Table
  const peersTable = grid.set(6, 7, 5, 5, contrib.table, {
    keys: true,
    fg: D.text,
    selectedFg: D.bright,
    selectedBg: D.bgSel,
    interactive: true,
    label: ` ${t(D.accent, 'Active Peers')} `,
    width: '100%',
    height: '100%',
    border: { type: 'line', fg: D.accentDim },
    style: { bg: D.bg, border: { fg: D.accentDim, bg: D.bg } },
    columnSpacing: 2,
    columnWidth: [15, 20, 10, 10]
  });

  // 5. Hotkeys Legend
  grid.set(11, 7, 1, 5, blessed.box, {
    content: `  ${t(D.accent, b('[↑/↓]'))} ${t(D.muted, 'Scroll')}   ${t(D.accent, b('[Esc/q]'))} ${t(D.muted, 'Back to Home')}`,
    tags: true,
    style: { bg: D.bg, fg: D.text }
  });

  const rxData = { title: 'RX', x: [], y: [], style: { line: D.success } };
  const txData = { title: 'TX', x: [], y: [], style: { line: D.warning } };
  
  // Seed initial chart data
  for (let i = 0; i < 20; i++) {
    const time = new Date(Date.now() - (20 - i) * 1000).toLocaleTimeString().split(' ')[0];
    rxData.x.push(time);
    rxData.y.push(0);
    txData.x.push(time);
    txData.y.push(0);
  }

  let prevRx = 0;
  let prevTx = 0;
  let hasInitWg = false;
  let currentIp = 'Loading...';
  let geoData = null;
  let latency = '...';
  let geoFetched = false;

  // ─── NAV HANDLER (FIXED) ────────────────────────────────────────────────
  let isClosing = false;
  const exitDashboard = async () => {
    if (isClosing) return;
    isClosing = true;
    screen.destroy();
    
    // Re-import and launch the master TUI
    const m = await import('./tui.js');
    await m.default();
  };

  screen.key(['escape', 'q', 'C-c', 'h'], exitDashboard);

  peersTable.focus();

  // ─── UPDATER ────────────────────────────────────────────────────────────
  const updateDashboard = async () => {
    if (isClosing) return;

    // 1. Fetch IP & GeoIP (runs once)
    if (!geoFetched) {
      geoFetched = true;
      try {
        currentIp = await getProxiedIp(info.port);
        geoData = await getGeoIp(currentIp);
        if (geoData) {
          mapWidget.addMarker({ lat: geoData.lat, lon: geoData.lon, color: 'red', char: 'X' });
        }
      } catch (err) {}
    }

    // 2. Fetch Ping
    const serverIp = info.server.split('@').pop();
    latency = pingServer(serverIp);

    // 3. Update Header
    const uptimeMin = Math.floor((Date.now() - new Date(info.startTime).getTime()) / 60000);
    headerBox.setContent(
      `  ${b('Status')}  ${t(D.success, 'UP')}\n` +
      `  ${b('Server')}  ${t(D.muted, info.server)}\n` +
      `  ${b('Mode')}    ${t(D.muted, (info.mode || 'ssh').toUpperCase())}\n` +
      `  ${b('IP')}      ${t(D.muted, currentIp)}\n` +
      `  ${b('Uptime')}  ${t(D.muted, uptimeMin + ' min')}\n` +
      `  ${b('Ping')}    ${t(D.accent, latency)}\n` +
      `  ${b('GeoIP')}   ${t(D.muted, geoData ? geoData.text : 'N/A')}`
    );

    // 4. Update WG Stats & Chart
    if (info.mode === 'wireguard' || info.mode === 'amneziawg' || info.mode === 'auto') {
      const stats = getWgStats();
      if (stats) {
        if (!hasInitWg) {
          prevRx = stats.totalRx;
          prevTx = stats.totalTx;
          hasInitWg = true;
        } else {
          const rxSpeed = stats.totalRx - prevRx;
          const txSpeed = stats.totalTx - prevTx;
          prevRx = stats.totalRx;
          prevTx = stats.totalTx;

          const time = new Date().toLocaleTimeString().split(' ')[0];
          rxData.x.shift(); rxData.x.push(time);
          rxData.y.shift(); rxData.y.push(rxSpeed);

          txData.x.shift(); txData.x.push(time);
          txData.y.shift(); txData.y.push(txSpeed);

          lineChart.setData([rxData, txData]);
        }

        const tableData = stats.peers.map(p => [
          p.pubKey, 
          p.endpoint || 'N/A', 
          formatBytes(p.rx), 
          formatBytes(p.tx)
        ]);
        
        peersTable.setData({
          headers: ['Peer', 'Endpoint', 'RX', 'TX'],
          data: tableData.length ? tableData : [['No peers', '-', '-', '-']]
        });
      }
    }

    screen.render();
  };

  const timer = setInterval(updateDashboard, 1000);
  
  // Clean up timer on exit
  screen.on('destroy', () => clearInterval(timer));

  updateDashboard();
  screen.render();
};
