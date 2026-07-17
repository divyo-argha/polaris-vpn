import blessed from 'blessed';
import contrib from 'blessed-contrib';
import { getActiveTunnel } from '../core/tunnel-service.js';
import { getProxiedIp } from '../net/ip-check.js';
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
      return { 
        text: `${data.city}, ${data.country}`,
        lat: data.lat,
        lon: data.lon,
        isp: data.isp
      };
    }
  } catch (err) {}
  return null;
};

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

export default async () => {
  const info = getActiveTunnel();
  
  if (!info) {
    console.error('Tunnel is down. Start the tunnel first to use the dashboard.');
    process.exit(1);
  }

  const screen = blessed.screen({
    smartCSR: true,
    title: 'Polaris VPN Dashboard'
  });

  const grid = new contrib.grid({ rows: 12, cols: 12, screen: screen });

  // 1. Header Box (Status, IP, Uptime)
  const headerBox = grid.set(0, 0, 3, 4, blessed.box, {
    label: ' Tunnel Status ',
    content: 'Loading...',
    tags: true,
    style: { fg: 'green', border: { fg: 'cyan' } }
  });

  // 2. Line Chart (Bandwidth)
  const lineChart = grid.set(0, 4, 6, 8, contrib.line, {
    label: ' Bandwidth (Bytes/s) ',
    showLegend: true,
    legend: { width: 12 },
    style: { baseline: 'gray', line: 'yellow', text: 'green' },
    xLabelPadding: 3,
    xPadding: 5
  });

  // 3. Map (GeoIP)
  const mapWidget = grid.set(3, 0, 9, 7, contrib.map, {
    label: ' Server Location ',
    style: { shapeColor: 'cyan' }
  });

  // 4. Peers Table
  const peersTable = grid.set(6, 7, 5, 5, contrib.table, {
    keys: true,
    fg: 'white',
    selectedFg: 'white',
    selectedBg: 'blue',
    interactive: true,
    label: ' Active Peers (Enter to select) ',
    width: '100%',
    height: '100%',
    border: { type: 'line', fg: 'cyan' },
    columnSpacing: 2,
    columnWidth: [15, 20, 10, 10]
  });

  // 5. Hotkeys Legend
  const legendBox = grid.set(11, 7, 1, 5, blessed.box, {
    content: ' {bold}[↑/↓]{/bold} Select | {bold}[Enter]{/bold} Info | {bold}[k]{/bold} Kill-Switch | {bold}[?]{/bold} Help | {bold}[q]{/bold} Quit',
    tags: true,
    style: { fg: 'yellow' }
  });

  const rxData = { title: 'RX', x: [], y: [], style: { line: 'green' } };
  const txData = { title: 'TX', x: [], y: [], style: { line: 'red' } };
  
  // Seed initial chart data
  for (let i = 0; i < 20; i++) {
    const t = new Date(Date.now() - (20 - i) * 1000).toLocaleTimeString().split(' ')[0];
    rxData.x.push(t);
    rxData.y.push(0);
    txData.x.push(t);
    txData.y.push(0);
  }

  let prevRx = 0;
  let prevTx = 0;
  let hasInitWg = false;
  let currentIp = 'Loading...';
  let geoData = null;
  let latency = '...';
  let geoFetched = false;

  screen.key(['escape', 'q', 'C-c'], () => {
    return process.exit(0);
  });

  const showModal = (title, text) => {
    const msg = blessed.message({
      parent: screen,
      border: 'line',
      height: 'shrink',
      width: 'half',
      top: 'center',
      left: 'center',
      label: ` {bold}${title}{/bold} `,
      tags: true,
      keys: true,
      hidden: false,
      style: { fg: 'white', bg: 'black', border: { fg: 'cyan' } }
    });
    msg.display(text, 0, () => {
      peersTable.focus();
      screen.render();
    });
  };

  screen.key(['?'], () => {
    showModal('Help & Shortcuts', ' {bold}[↑/↓]{/bold}   Navigate peers\n {bold}[Enter]{/bold} View selected peer details\n {bold}[k]{/bold}       Toggle network kill-switch\n {bold}[q]{/bold}       Quit dashboard\n\nPress any key to close.');
  });

  screen.key(['k'], () => {
    showModal('Kill-Switch', ' {red-fg}Action not yet linked.{/red-fg}\n Will disconnect all non-VPN traffic.\n\nPress any key to close.');
  });

  peersTable.rows.on('select', (item, index) => {
    const peerName = item.content.split(' ')[0] || 'Unknown';
    showModal('Peer Action', ` {bold}Peer:{/bold} ${peerName}\n\n Viewing and disconnecting specific peers directly\n from the TUI will be available in v1.1.\n\nPress any key to close.`);
  });

  // Focus table by default to allow interaction
  peersTable.focus();

  const updateDashboard = async () => {
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
      `{bold}Status{/bold}:  {green-fg}UP{/green-fg}\n` +
      `{bold}Server{/bold}:  ${info.server}\n` +
      `{bold}Mode{/bold}:    ${(info.mode || 'ssh').toUpperCase()}\n` +
      `{bold}IP{/bold}:      ${currentIp}\n` +
      `{bold}Uptime{/bold}:  ${uptimeMin} min\n` +
      `{bold}Ping{/bold}:    ${latency}\n` +
      `{bold}GeoIP{/bold}:   ${geoData ? geoData.text : 'N/A'}`
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

          const t = new Date().toLocaleTimeString().split(' ')[0];
          rxData.x.shift();
          rxData.x.push(t);
          rxData.y.shift();
          rxData.y.push(rxSpeed);

          txData.x.shift();
          txData.x.push(t);
          txData.y.shift();
          txData.y.push(txSpeed);

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

  setInterval(updateDashboard, 1000);
  updateDashboard();
  screen.render();
};
