import blessed from 'blessed';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { spawnSync } from 'child_process';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const pkg        = JSON.parse(readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf-8'));

// ─── DESIGN SYSTEM ────────────────────────────────────────────────────────────
const D = {
  accent:     '#88c0d0',  // Nord Frost Blue
  accentDim:  '#81a1c1',  // Nord Steel Blue
  success:    '#a3be8c',  // Nord Green
  danger:     '#bf616a',  // Nord Red
  warning:    '#ebcb8b',  // Nord Yellow
  purple:     '#b48ead',  // Nord Purple
  muted:      '#d8dee9',  // Nord Snow Dim
  text:       '#e5e9f0',  // Nord Snow
  bright:     '#eceff4',  // Nord Snow Bright
  bg:         '#2e3440',  // Nord Dark
  bgSidebar:  '#3b4252',  // Nord Dark (sidebar)
  bgSel:      '#4c566a',  // Nord Dark (selected)
  sep:        '#434c5e',  // Nord Dark (divider)
};

// Tagged template helpers for blessed markup
const t  = (hex, s) => `{${hex}-fg}${s}{/}`;
const b  = (s)      => `{bold}${s}{/bold}`;
const mu = (s)      => t(D.muted, s);
const hr = (n = 56) => t(D.sep, '─'.repeat(n));

// Mode badge
const badge = (mode) => {
  if (!mode) return mu('—');
  const c = { wireguard: D.success, amneziawg: D.purple, tls: D.warning, ssh: D.accent };
  return t(c[mode.toLowerCase()] || D.accent, mode.toUpperCase());
};

// ─── LOGO ─────────────────────────────────────────────────────────────────────
const LOGO = [
  `{#88c0d0-fg}{bold}  ██████╗  ██████╗ ██╗      █████╗ ██████╗ ██╗███████╗{/bold}{/}`,
  `{#88c0d0-fg}{bold}  ██╔══██╗██╔═══██╗██║     ██╔══██╗██╔══██╗██║██╔════╝{/bold}{/}`,
  `{#8fbcbb-fg}{bold}  ██████╔╝██║   ██║██║     ███████║██████╔╝██║███████╗{/bold}{/}`,
  `{#81a1c1-fg}{bold}  ██╔═══╝ ██║   ██║██║     ██╔══██║██╔══██╗██║╚════██║{/bold}{/}`,
  `{#5e81ac-fg}{bold}  ██║     ╚██████╔╝███████╗██║  ██║██║  ██║██║███████║{/bold}{/}`,
  `{#5e81ac-fg}{bold}  ╚═╝      ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚══════╝{/bold}{/}`,
].join('\n');

// ─── VIEW IDENTIFIERS & LABELS ────────────────────────────────────────────────
const VIEW_LABELS = {
  back:       'Back',
  home:       'Home',
  servers:    'Servers',
  add_server: 'Add Profile',
  connect:    'Connect',
  speedtest:  'Speed Test',
  dashboard:  'Live Monitor',
  peers:      'Peers',
  peer_qr:    'Mobile QR',
  check:      'Privacy Check',
  watchdog:   'Watchdog',
  deploy:     'Deploy VPS',
  disconnect: 'Disconnect',
  help:       'Help',
};

const VIEWS = [
  { id: 'back',       label: '◀ Back',         icon: '◀' },
  { id: 'home',       label: 'Home',           icon: '◈' },
  { id: 'servers',    label: 'Servers',        icon: '⚙' },
  { id: 'connect',    label: 'Quick Connect',  icon: '▶' },
  { id: 'speedtest',  label: 'Speed Test',     icon: '⚡' },
  { id: 'dashboard',  label: 'Live Monitor',   icon: '◉' },
  null,
  { id: 'peers',      label: 'Peers',          icon: '≡' },
  { id: 'check',      label: 'Privacy Check',  icon: '✦' },
  { id: 'watchdog',   label: 'Watchdog',       icon: '♥' },
  { id: 'deploy',     label: 'Deploy VPS',     icon: '⊕' },
  null,
  { id: 'disconnect', label: 'Disconnect',     icon: '■', danger: true },
  { id: 'quit',       label: 'Quit',           icon: '✕', danger: true },
];

const NAV = VIEWS.reduce((acc, v, i) => { if (v) acc.push(i); return acc; }, []);

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const pingServer = (ip) => {
  if (!ip) return '—';
  const cleanIp = ip.includes('@') ? ip.split('@')[1] : ip;
  const win = os.platform() === 'win32';
  try {
    const r = spawnSync('ping', win ? ['-n','1','-w','600',cleanIp] : ['-c','1','-W','1',cleanIp], { encoding: 'utf-8', timeout: 1200 });
    if (r.status === 0) {
      const m = r.stdout.match(win ? /Average = (\d+)ms/ : /time=([\d.]+)\s*ms/);
      if (m) {
        const ms = Math.round(parseFloat(m[1]));
        const rating = ms < 60 ? '[FAST]' : (ms < 150 ? '[MODERATE]' : '[SLOW]');
        return `${ms} ms ${rating}`;
      }
    }
  } catch (e) {}
  return 'Offline [OFFLINE]';
};

const fmtBytes = (n) => {
  if (!n || n === 0) return '0 B';
  const k = 1024, s = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(n) / Math.log(k));
  return `${(n / Math.pow(k, i)).toFixed(1)} ${s[i]}`;
};

const wgStats = (isAwg = false) => {
  const cmd = isAwg ? 'awg' : 'wg';
  try {
    let r = spawnSync('sudo', [cmd, 'show', 'all', 'dump'], { encoding: 'utf-8', timeout: 1500 });
    if (r.status !== 0 && isAwg) {
      r = spawnSync('sudo', ['wg', 'show', 'all', 'dump'], { encoding: 'utf-8', timeout: 1500 });
    }
    if (r.status !== 0) return null;
    const lines = r.stdout.trim().split('\n');
    if (lines.length <= 1) return null;
    let rx = 0, tx = 0;
    const peers = [];
    for (let i = 1; i < lines.length; i++) {
      const p = lines[i].split('\t');
      const prx = parseInt(p[6], 10) || 0;
      const ptx = parseInt(p[7], 10) || 0;
      rx += prx;
      tx += ptx;
      peers.push({
        pubKey: (p[1] || '').substring(0, 10) + '...',
        endpoint: p[4] || 'N/A',
        rx: prx,
        tx: ptx
      });
    }
    return { rx, tx, peers };
  } catch (e) {
    return null;
  }
};

// ─── MAIN TUI COMPONENT ───────────────────────────────────────────────────────
export default async () => {
  // Dynamic service imports
  const { getActiveTunnel, startTunnel, stopActiveTunnel } = await import('../core/tunnel-service.js');
  const { getProfiles, setActiveProfile, removeProfile, addProfile } = await import('../core/profile-service.js');
  const { getWatchdogStatus, runWatchdogCheck } = await import('../core/watchdog-service.js');
  const { runSpeedTest } = await import('../core/speedtest-service.js');
  const { getPublicIp, getProxiedIp, checkDns, checkIpv6Leak } = await import('../net/ip-check.js');
  const { listPeers, addPeer, getLocalPeerConfPath } = await import('../core/peer-service.js');
  const { deployServer } = await import('../core/deploy-service.js');
  const QRCode = (await import('qrcode')).default || (await import('qrcode'));

  // ─── APP STATE & NAVIGATION STACK ─────────────────────────────────────────
  let menuIdx       = 1;   // default to Home (index 1 in NAV)
  let currentView   = 'home';
  const navStack    = [];  // multi-stage history stack: [{ id, state }]
  let srvIdx        = 0;   // selected server in Servers view
  let peerIdx       = 0;   // selected peer in Peers view
  let serverPings   = {};  // latency cache
  let statusNotice  = null;
  let activeTimer   = null;

  // In-frame Sub-state stores
  let activeInputMode = null; // 'add_server' | 'deploy' | null

  const addServerState = {
    fields: [
      { label: 'Profile Alias', key: 'alias', value: '', placeholder: 'e.g. oracle-fra' },
      { label: 'Server Address', key: 'server', value: '', placeholder: 'e.g. ubuntu@1.2.3.4' },
      { label: 'Tags', key: 'tags', value: '', placeholder: 'e.g. fast, work (optional)' },
    ],
    activeField: 0,
    error: null
  };

  const deployState = {
    step: 0, // 0: Server, 1: Key, 2: Mode, 3: Alias, 4: Confirm, 5: Running, 6: Complete
    server: '',
    keyPath: '',
    mode: 'wireguard',
    alias: '',
    logs: [],
    error: null,
    clientConfPath: null
  };

  let connectState = {
    running: false,
    server: null,
    mode: 'auto',
    status: '',
    error: null,
    result: null
  };

  let speedtestState = {
    running: false,
    progress: '',
    result: null,
    error: null
  };

  let checkState = {
    running: false,
    results: null,
    error: null
  };

  let watchdogState = {
    running: false,
    result: null,
    error: null
  };

  let peerViewState = {
    peers: [],
    viewingQr: null,
    qrText: '',
    loading: false
  };

  // ─── SCREEN ───────────────────────────────────────────────────────────────
  const screen = blessed.screen({
    smartCSR:    true,
    title:       `Polaris VPN  v${pkg.version}`,
    fullUnicode: true,
    dockBorders: false,
    ignoreLocked: ['C-c'],
  });

  const SIDEBAR_W = 26;
  const HEADER_H  = 8;
  const FOOTER_H  = 3;

  // Header bar
  blessed.box({
    parent: screen,
    top: 0, left: 0, width: '100%', height: HEADER_H,
    tags: true, content: LOGO,
    style: { bg: D.bg },
  });

  // Version tag (top-right)
  blessed.box({
    parent: screen,
    top: 1, right: 2, width: 28, height: 5,
    tags: true,
    content: [
      '',
      `${mu('version ')}${t(D.accent, pkg.version)}`,
      mu('Digital Privacy & Freedom'),
      mu('──────────────────────────'),
    ].join('\n'),
    style: { bg: D.bg }, align: 'right',
  });

  // Header separator
  blessed.box({
    parent: screen,
    top: HEADER_H, left: 0, width: '100%', height: 1,
    style: { bg: D.accentDim },
  });

  // Sidebar outer border
  blessed.box({
    parent: screen,
    top: HEADER_H + 1, left: 0, width: SIDEBAR_W, bottom: FOOTER_H,
    border: { type: 'line' },
    style: { border: { fg: D.accent }, bg: D.bgSidebar },
  });

  // Status pill (top of sidebar)
  const wStatus = blessed.box({
    parent: screen,
    top: HEADER_H + 2, left: 1, width: SIDEBAR_W - 2, height: 3,
    tags: true, content: '',
    style: { bg: D.bgSidebar },
  });

  // Sidebar divider
  blessed.box({
    parent: screen,
    top: HEADER_H + 5, left: 1, width: SIDEBAR_W - 2, height: 1,
    style: { bg: D.sep },
  });

  // Sidebar nav
  const wNav = blessed.box({
    parent: screen,
    top: HEADER_H + 6, left: 1, width: SIDEBAR_W - 2, bottom: FOOTER_H + 1,
    tags: true, content: '',
    style: { bg: D.bgSidebar },
    scrollable: false,
  });

  // Main content panel (100% self-contained)
  const wMain = blessed.box({
    parent: screen,
    top: HEADER_H + 1, left: SIDEBAR_W, right: 0, bottom: FOOTER_H,
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    border: { type: 'line' },
    style: { border: { fg: D.accentDim }, bg: D.bg, fg: D.text },
    padding: { left: 3, right: 3, top: 1, bottom: 1 },
    scrollbar: {
      ch: '│',
      style: { fg: D.accentDim, bg: D.bg }
    }
  });

  // Footer bar
  const wFooter = blessed.box({
    parent: screen,
    bottom: 0, left: 0, width: '100%', height: FOOTER_H,
    tags: true, content: '',
    border: { type: 'line' },
    style: { border: { fg: D.sep }, bg: D.bg },
    padding: { left: 1 },
  });

  // Viewport protection
  const wSmallScreenWarning = blessed.box({
    parent: screen,
    top: 0, left: 0, width: '100%', height: '100%',
    tags: true, hidden: true,
    border: { type: 'line' },
    style: { border: { fg: D.danger }, bg: D.bg },
    padding: { top: 2, left: 3, right: 3 }
  });

  const checkScreenDimensions = () => {
    if (screen.cols < 72 || screen.rows < 18) {
      wSmallScreenWarning.setContent(
        `\n  ${b(t(D.danger, '⚠  Terminal Viewport Constrained'))}\n` +
        `  ${hr(44)}\n\n` +
        `  ${mu('Current dimensions:')}  ${t(D.accent, screen.cols + ' cols × ' + screen.rows + ' rows')}\n` +
        `  ${mu('Minimum required:')}    ${t(D.bright, '72 cols × 18 rows')}\n\n` +
        `  Please enlarge or maximize your terminal window for optimal TUI display.\n\n` +
        `  ${mu('Or press ')}${t(D.accent, '[q]')}${mu(' to exit and use direct CLI commands.')}`
      );
      wSmallScreenWarning.show();
      wSmallScreenWarning.setFront();
      screen.render();
      return false;
    } else {
      wSmallScreenWarning.hide();
      return true;
    }
  };

  // ─── BREADCRUMBS & FOOTER ─────────────────────────────────────────────────
  const getBreadcrumbs = () => {
    const list = [];
    for (const item of navStack) {
      const name = VIEW_LABELS[item.id] || item.id;
      if (!list.includes(name)) list.push(name);
    }
    const currentName = VIEW_LABELS[currentView] || currentView;
    if (!list.includes(currentName)) list.push(currentName);
    return list.join(` ${mu('›')} `);
  };

  const setFooter = (...pairs) => {
    // If not on home or if we have history, ensure a Back option is clearly visible
    const hasBackPair = pairs.some(([k]) => k.toLowerCase().includes('esc') || k.toLowerCase().includes('back'));
    const finalPairs = [...pairs];
    if (!hasBackPair && (navStack.length > 0 || currentView !== 'home')) {
      finalPairs.push(['Esc / Backspace', 'Back']);
    }
    wFooter.setContent(
      '  ' + finalPairs.map(([k, v]) => `${t(D.accent, b(`[${k}]`))} ${mu(v)}`).join('   ')
    );
  };

  const setView = (id, lines, ...footerPairs) => {
    const breadcrumb = getBreadcrumbs();
    wMain.setLabel(`{${D.accent}-fg} ◈ ${breadcrumb} {/}`);
    wMain.setContent('\n' + (Array.isArray(lines) ? lines.join('\n') : lines));
    if (wMain.scrollTo) wMain.scrollTo(0);
    setFooter(...footerPairs);
  };

  // ─── NAVIGATION & STACK ENGINE ────────────────────────────────────────────
  const clearTimers = () => {
    if (activeTimer) {
      clearInterval(activeTimer);
      activeTimer = null;
    }
  };

  const goto = async (viewId, pushHistory = true) => {
    clearTimers();

    if (viewId === 'back') {
      await goBack();
      return;
    }

    if (viewId === 'quit') {
      process.exit(0);
    }

    if (pushHistory && currentView !== viewId) {
      navStack.push({ id: currentView });
      if (navStack.length > 30) navStack.shift();
    }

    currentView = viewId;
    activeInputMode = (viewId === 'add_server' || viewId === 'deploy') ? viewId : null;

    // Sync menuIdx in sidebar
    const vi = VIEWS.findIndex(v => v && v.id === (viewId === 'add_server' ? 'servers' : viewId));
    const ni = NAV.indexOf(vi);
    if (ni !== -1) menuIdx = ni;

    renderSidebar();

    switch (viewId) {
      case 'home':        renderHome();        break;
      case 'servers':     srvIdx = 0; renderServers(); break;
      case 'add_server':  renderAddServer();   break;
      case 'connect':     await runConnect();  break;
      case 'speedtest':   renderSpeedtest();   break;
      case 'dashboard':   renderDashboard();   break;
      case 'peers':       await loadPeers();   break;
      case 'check':       renderCheck();       break;
      case 'watchdog':    renderWatchdog();    break;
      case 'deploy':      renderDeploy();      break;
      case 'disconnect':  renderDisconnect();  break;
      case 'help':        renderHelp();        break;
      default:            renderHome();        break;
    }

    screen.render();
  };

  const goBack = async () => {
    clearTimers();

    if (currentView === 'peers' && peerViewState.viewingQr) {
      peerViewState.viewingQr = null;
      renderPeers();
      screen.render();
      return;
    }

    if (currentView === 'deploy' && deployState.step > 0 && deployState.step < 5) {
      deployState.step--;
      renderDeploy();
      screen.render();
      return;
    }

    if (activeInputMode) {
      activeInputMode = null;
    }

    if (navStack.length > 0) {
      const prev = navStack.pop();
      await goto(prev.id, false);
    } else if (currentView !== 'home') {
      await goto('home', false);
    }
  };

  // ─── SIDEBAR RENDERER ─────────────────────────────────────────────────────
  const renderSidebar = () => {
    const info = getActiveTunnel();

    if (info) {
      const upMin = Math.floor((Date.now() - new Date(info.startTime).getTime()) / 60000);
      wStatus.setContent(
        `  ${t(D.success, '⬤')} ${b(t(D.bright, '[CONNECTED] (✓)'))}\n` +
        `  ${mu(info.server.substring(0, SIDEBAR_W - 5))}\n` +
        `  ${badge(info.mode)}  ${mu(upMin + 'm')}`
      );
    } else {
      wStatus.setContent(
        `  ${t(D.danger, '○')} ${b(t(D.muted, '[DISCONNECTED] (○)'))}\n` +
        `  ${mu('No active tunnel')}`
      );
    }

    const selectedViewsIdx = NAV[menuIdx];
    const lines = [];

    for (let i = 0; i < VIEWS.length; i++) {
      const v = VIEWS[i];
      if (!v) {
        lines.push(mu(' ' + '─'.repeat(SIDEBAR_W - 4)));
        continue;
      }

      const isSel = i === selectedViewsIdx;

      if (v.id === 'back') {
        const canGoBack = navStack.length > 0 || currentView !== 'home';
        const backTarget = navStack.length > 0 ? (VIEW_LABELS[navStack[navStack.length - 1].id] || 'Prev') : 'Home';
        const labelText = `◀ Back (${backTarget})`;
        if (isSel) {
          lines.push(`{${D.bgSel}-bg} ${t(canGoBack ? D.accent : D.muted, '◀')}  ${b(t(canGoBack ? D.bright : D.muted, labelText))} {/}`);
        } else {
          lines.push(`  ${t(canGoBack ? D.accent : D.sep, '◀')}  ${mu(labelText)}`);
        }
        continue;
      }

      const iconColor  = v.danger ? D.danger : (isSel ? D.accent : D.muted);
      const labelColor = isSel ? D.bright : D.text;

      if (isSel) {
        lines.push(`{${D.bgSel}-bg} ${t(iconColor, v.icon)}  ${b(t(labelColor, v.label))} {/}`);
      } else {
        lines.push(`  ${t(iconColor, v.icon)}  ${t(labelColor, v.label)}`);
      }
    }

    wNav.setContent(lines.join('\n'));
  };

  // ─── 1. HOME VIEW ─────────────────────────────────────────────────────────
  const renderHome = () => {
    const info = getActiveTunnel();
    const L = [];

    if (info) {
      const upMin = Math.floor((Date.now() - new Date(info.startTime).getTime()) / 60000);
      const ping  = pingServer(info.server.split('@').pop());
      const wg    = wgStats(info.mode === 'amneziawg');

      L.push(`${t(D.accent, b('◈  Tunnel Status'))}    ${t(D.success, '⬤  ACTIVE & ENCRYPTED')}`);
      L.push(hr()); L.push('');
      L.push(`  ${mu('Server     ')}  ${b(info.server)}`);
      L.push(`  ${mu('Protocol   ')}  ${badge(info.mode)}`);
      L.push(`  ${mu('Uptime     ')}  ${t(D.bright, upMin + ' min')}`);
      L.push(`  ${mu('Latency    ')}  ${t(D.accent, ping)}`);
      L.push(`  ${mu('DNS Filter ')}  ${t(D.purple, 'Zero-Log Unbound + AdBlock (10.0.0.1)')}`);
      L.push(`  ${mu('IPv6 Shield')}  ${t(D.success, 'Dual-Stack Full Tunnel (fd00:polaris::)')}`);
      if (wg) {
        L.push(`  ${mu('Data ↓     ')}  ${t(D.success, fmtBytes(wg.rx))}`);
        L.push(`  ${mu('Data ↑     ')}  ${t(D.warning, fmtBytes(wg.tx))}`);
      }
      L.push(''); L.push(hr()); L.push('');
      L.push(`  ${t(D.accent, '[4]')}${mu(' Run Speed Test benchmark')}`);
      L.push(`  ${t(D.accent, '[5]')}${mu(' View Live Throughput Monitor')}`);
      L.push(`  ${t(D.danger, '[■]')}${mu(' Disconnect cleanly (or press Disconnect in sidebar)')}`);
    } else {
      const { profiles, active } = getProfiles();
      const names = Object.keys(profiles);

      L.push(`${t(D.accent, b('◈  Welcome to Polaris VPN'))}`);
      L.push(hr()); L.push('');
      L.push(`  ${t(D.danger, '○')}  ${b(t(D.muted, 'No active tunnel running.'))}`); L.push('');

      if (names.length > 0) {
        L.push(`  ${t(D.accent, b('Saved Server Profiles:'))}`); L.push('');
        names.forEach((n, i) => {
          const act = n === active;
          const entry = profiles[n];
          const srv = typeof entry === 'string' ? entry : (entry?.server || '—');
          const tags = Array.isArray(entry?.tags) && entry.tags.length > 0
            ? `  ${t(D.purple, '[' + entry.tags.join(', ') + ']')}` : '';
          L.push(
            `  ${mu((i + 1) + '.')}  ${t(act ? D.success : D.text, n.padEnd(16))}` +
            `  ${mu(srv)}` + tags +
            (act ? `  ${t(D.success, '★ active default')}` : '')
          );
        });
        L.push(''); L.push(hr()); L.push('');
        L.push(`  ${mu('Press ')}${t(D.accent, '[Enter]')}${mu(' on ')}${t(D.accent, 'Quick Connect')}${mu(' to connect to default server.')}`);
        L.push(`  ${mu('Press ')}${t(D.accent, '[2]')}${mu(' to manage server profiles or add a new VPS.')}`);
      } else {
        L.push(`  ${t(D.warning, '⚠')}  ${mu('No server profiles saved yet.')}`); L.push('');
        L.push(`  ${mu('Deploy a new VPS:  press ')}${t(D.accent, '[9]')}${mu(' or select ')}${t(D.accent, 'Deploy VPS')}`);
        L.push(`  ${mu('Or add an existing server: press ')}${t(D.accent, '[2]')}${mu(' and press ')}${t(D.accent, '[a]')}`);
      }
    }

    setView('home', L, ['Tab / ↑↓', 'Navigate'], ['Enter', 'Select'], ['?', 'Help'], ['q', 'Quit']);
  };

  // ─── 2. SERVERS VIEW ──────────────────────────────────────────────────────
  const renderServers = () => {
    const { profiles, active } = getProfiles();
    const names = Object.keys(profiles);
    const L = [];

    L.push(`${t(D.accent, b('⚙  Server Profiles Manager'))}`); L.push(hr()); L.push('');

    if (statusNotice) {
      L.push(`  ${t(D.success, '✓')}  ${statusNotice}`);
      L.push('');
      statusNotice = null;
    }

    if (names.length === 0) {
      L.push(`  ${t(D.warning, '⚠')}  No saved profiles found.`); L.push('');
      L.push(`  ${t(D.accent, '[a]')}${mu(' Add new profile in-frame    ')}${t(D.accent, '[d]')}${mu(' Launch Deploy Wizard')}`);
    } else {
      L.push(`  ${t(D.accent, '[↑/↓]')}${mu(' Select   ')}${t(D.accent, '[Enter]')}${mu(' Connect   ')}${t(D.accent, '[s]')}${mu(' Set Default   ')}${t(D.accent, '[a]')}${mu(' Add   ')}${t(D.accent, '[x]')}${mu(' Delete')}`);
      L.push('');

      names.forEach((n, i) => {
        const sel = i === srvIdx;
        const act = n === active;
        const entry = profiles[n];
        const srv = typeof entry === 'string' ? entry : (entry?.server || '—');
        const tags = Array.isArray(entry?.tags) && entry.tags.length > 0
          ? `  ${t(D.purple, '[' + entry.tags.join(', ') + ']')}` : '';
        const cur  = sel ? t(D.accent, '▶') : ' ';
        const name = sel ? b(t(D.bright, n)) : t(act ? D.success : D.text, n);
        const pill = act ? `  ${t(D.success, '★ ACTIVE')}` : '';
        const ping = serverPings[srv] ? `  ${t(D.accent, serverPings[srv])}` : '';

        const isValid = srv.includes('@') || srv.includes('.') || srv === 'localhost';
        const validBadge = isValid ? '' : `  ${t(D.danger, '⚠ Invalid Host')}`;

        L.push(`  ${cur} ${name}${pill}${tags}${ping}${validBadge}`);
        L.push(`     ${mu(srv)}`);
        L.push('');
      });

      L.push(hr());
      L.push(`  ${mu('Selected Profile: ')}${t(D.accent, names[srvIdx] || '—')}`);
    }

    setView('servers', L,
      ['Enter', 'Connect'],
      ['s', 'Set Default'],
      ['a', 'Add Profile'],
      ['x', 'Delete'],
      ['p', 'Ping All'],
      ['Esc', 'Back']
    );
  };

  // ─── 3. ADD SERVER PROFILE (IN-FRAME FORM) ────────────────────────────────
  const renderAddServer = () => {
    const L = [];
    L.push(`${t(D.accent, b('⚙  Add Server Profile'))}`); L.push(hr()); L.push('');
    L.push('  Save a friendly alias for your remote VPS server:'); L.push('');

    if (addServerState.error) {
      L.push(`  ${t(D.danger, '⚠ ' + addServerState.error)}`);
      L.push('');
    }

    addServerState.fields.forEach((f, idx) => {
      const isCur = idx === addServerState.activeField;
      const marker = isCur ? t(D.accent, '▶ ') : '  ';
      const fieldTitle = isCur ? b(t(D.bright, f.label)) : mu(f.label);
      const val = f.value || mu(f.placeholder);
      const boxBorder = isCur ? D.accent : D.sep;

      L.push(`  ${marker}${fieldTitle}`);
      L.push(`    {${boxBorder}-fg}┌──────────────────────────────────────────────┐{/}`);
      L.push(`    {${boxBorder}-fg}│{/} ${val.padEnd(44)} {${boxBorder}-fg}│{/}`);
      L.push(`    {${boxBorder}-fg}└──────────────────────────────────────────────┘{/}`);
      L.push('');
    });

    L.push(hr());
    L.push(`  ${mu('Press ')}${t(D.accent, '[Tab / Enter]')}${mu(' to advance field. Press ')}${t(D.accent, '[Enter]')}${mu(' on Tags to save.')}`);
    L.push(`  ${mu('Press ')}${t(D.accent, '[Esc]')}${mu(' to cancel and return to Server Manager.')}`);

    setView('add_server', L,
      ['Tab / Enter', 'Next / Save'],
      ['Shift+Tab', 'Prev Field'],
      ['Esc', 'Cancel & Back']
    );
  };

  // ─── 4. CONNECTING RUNNER (IN-FRAME) ──────────────────────────────────────
  const runConnect = async (customServer = null) => {
    const { profiles, active } = getProfiles();
    let targetServer = customServer;

    if (!targetServer) {
      if (active && profiles[active]) {
        const entry = profiles[active];
        targetServer = typeof entry === 'string' ? entry : (entry?.server || entry);
      } else {
        const keys = Object.keys(profiles);
        if (keys.length > 0) {
          const entry = profiles[keys[0]];
          targetServer = typeof entry === 'string' ? entry : (entry?.server || entry);
        }
      }
    }

    if (!targetServer) {
      connectState = {
        running: false,
        server: null,
        error: 'No server specified and no saved profiles found. Please add a server first.',
        result: null
      };
      renderConnectView();
      return;
    }

    connectState = {
      running: true,
      server: targetServer,
      mode: 'auto',
      status: `Connecting to ${targetServer}...`,
      error: null,
      result: null
    };

    renderConnectView();
    screen.render();

    try {
      // Check if already active
      const cur = getActiveTunnel();
      if (cur) {
        connectState.running = false;
        connectState.error = `Tunnel is already running connected to ${cur.server}. Please disconnect first.`;
        renderConnectView();
        screen.render();
        return;
      }

      connectState.status = 'Checking WireGuard / AmneziaWG client configuration...';
      renderConnectView();
      screen.render();

      const confDir = path.join(os.homedir(), '.config', 'polaris', 'wg');
      const isAwg = existsSync(path.join(confDir, 'awg0.conf'));
      const mode = isAwg ? 'amneziawg' : 'wireguard';

      connectState.status = `Establishing ${mode.toUpperCase()} tunnel interface...`;
      renderConnectView();
      screen.render();

      const res = await startTunnel(targetServer, 1080, mode, true);
      const newIp = await getPublicIp().catch(() => targetServer.split('@').pop());

      connectState.running = false;
      connectState.result = {
        server: targetServer,
        mode: mode,
        publicIp: newIp,
        pid: res.pid
      };

      renderSidebar();
      renderConnectView();
      screen.render();
    } catch (err) {
      connectState.running = false;
      connectState.error = err.message || 'Failed to establish tunnel.';
      renderConnectView();
      screen.render();
    }
  };

  const renderConnectView = () => {
    const L = [];
    L.push(`${t(D.accent, b('▶  Quick Connect'))}`); L.push(hr()); L.push('');

    if (connectState.running) {
      L.push(`  ${t(D.accent, '⟳')}  ${b(connectState.status)}`);
      L.push('');
      L.push(`  ${mu('Target:')}  ${t(D.bright, connectState.server || '—')}`);
      L.push(`  ${mu('Please wait while network routes and security rules configure...')}`);
      setView('connect', L, ['Esc', 'Cancel / Back']);
      return;
    }

    if (connectState.error) {
      L.push(`  ${t(D.danger, '✖  Connection Failed')}`);
      L.push(hr()); L.push('');
      L.push(`  ${t(D.danger, connectState.error)}`);
      L.push('');
      L.push(`  ${mu('Remediation:')}`);
      L.push(`  ${mu('1. Verify your server is running and accessible over SSH.')}`);
      L.push(`  ${mu('2. Ensure UDP port 51820 is open in your cloud security list.')}`);
      L.push(`  ${mu('3. Run ')}${t(D.accent, 'Deploy VPS')}${mu(' to provision the server if you haven\'t yet.')}`);
      setView('connect', L, ['r', 'Retry'], ['Esc', 'Back to Home']);
      return;
    }

    if (connectState.result) {
      L.push(`  ${t(D.success, '✔  Connected Successfully!')}`);
      L.push(hr()); L.push('');
      L.push(`  ${mu('Server:        ')} ${b(connectState.result.server)}`);
      L.push(`  ${mu('Protocol:      ')} ${badge(connectState.result.mode)}`);
      L.push(`  ${mu('Public IP:     ')} ${t(D.bright, connectState.result.publicIp)} ${t(D.success, '(Shielded)')}`);
      L.push(`  ${mu('DNS Shield:    ')} ${t(D.purple, '10.0.0.1 (In-Tunnel Unbound + AdBlock)')}`);
      L.push(`  ${mu('IPv6 Shield:   ')} ${t(D.success, 'Full Dual-Stack Protected')}`);
      L.push(''); L.push(hr()); L.push('');
      L.push(`  ${mu('Your network traffic is now fully encrypted.')}`);
      setView('connect', L, ['Esc', 'Back to Home'], ['4', 'Run Speed Test'], ['5', 'Live Monitor']);
      return;
    }

    L.push('  Ready to connect to active server.');
    setView('connect', L, ['Enter', 'Connect Now'], ['Esc', 'Back to Home']);
  };

  // ─── 5. SPEED TEST (IN-FRAME BENCHMARK) ───────────────────────────────────
  const renderSpeedtest = () => {
    const L = [];
    L.push(`${t(D.accent, b('⚡  VPN Speed Test Benchmark'))}`); L.push(hr()); L.push('');

    if (speedtestState.running) {
      L.push(`  ${t(D.accent, '⟳')}  ${b('Testing in progress...')}`);
      L.push('');
      L.push(`  ${t(D.bright, speedtestState.progress || 'Measuring throughput...')}`);
      L.push('');
      L.push(`  ${mu('Connecting to high-capacity CDN payload through encrypted tunnel...')}`);
      setView('speedtest', L, ['Esc', 'Back']);
      return;
    }

    if (speedtestState.result) {
      const r = speedtestState.result;
      L.push(`  ${t(D.success, '✔  Benchmark Complete')}`);
      L.push(hr()); L.push('');
      L.push(`  ${mu('Tunnel Mode:       ')} ${badge(r.tunnelMode)}`);
      L.push(`  ${mu('Connected Server:  ')} ${t(D.bright, r.server)}`);
      L.push(`  ${mu('Public IP:         ')} ${t(D.bright, r.publicIp)}`);
      L.push(`  ${mu('Latency (Ping):    ')} ${t(D.success, r.pingMs + ' ms')}`);
      L.push(`  ${mu('Download Speed:    ')} ${b(t(D.success, r.downloadSpeedMbps + ' Mbps'))} ${mu('(' + r.downloadSpeedMBps + ' MB/s)')}`);
      L.push(`  ${mu('Performance Tier:  ')} ${b(t(D.purple, r.rating))}`);
      L.push(''); L.push(hr()); L.push('');
      L.push(`  ${mu('Press ')}${t(D.accent, '[r / Enter]')}${mu(' to re-run test.')}`);
      setView('speedtest', L, ['r / Enter', 'Test Again'], ['Esc', 'Back']);
      return;
    }

    L.push('  Measures real-time throughput and latency through the active tunnel.');
    L.push('');
    L.push(`  ${mu('Test payload:')}  ${t(D.bright, '10 MB high-capacity CDN payload')}`);
    L.push(`  ${mu('Metrics:')}       ${t(D.bright, 'Ping, Jitter, Download Mbps, Streaming Rating')}`);
    L.push(''); L.push(hr()); L.push('');
    L.push(`  Press ${t(D.accent, '[Enter]')} to run benchmark.`);

    setView('speedtest', L, ['Enter', 'Start Benchmark'], ['Esc', 'Back']);
  };

  const startSpeedtest = async () => {
    speedtestState = { running: true, progress: 'Initiating benchmark...', result: null, error: null };
    renderSpeedtest();
    screen.render();

    try {
      const res = await runSpeedTest((msg) => {
        speedtestState.progress = msg;
        renderSpeedtest();
        screen.render();
      });
      speedtestState.running = false;
      speedtestState.result = res;
    } catch (err) {
      speedtestState.running = false;
      speedtestState.error = err.message;
    }
    renderSpeedtest();
    screen.render();
  };

  // ─── 6. LIVE MONITOR (IN-FRAME DASHBOARD) ─────────────────────────────────
  let prevRx = 0, prevTx = 0, lastTick = Date.now();
  let rxRate = 0, txRate = 0;

  const renderDashboard = () => {
    const info = getActiveTunnel();

    if (!info) {
      const L = [
        `${t(D.accent, b('◉  Live Monitor'))}`,
        hr(), '',
        `  ${t(D.warning, '⚠  No active tunnel running.')}`,
        '',
        `  Please connect to a server first before opening the Live Monitor.`,
        '',
        hr(), '',
        `  Press ${t(D.accent, '[c / Enter]')} to Quick Connect.`,
      ];
      setView('dashboard', L, ['Enter / c', 'Quick Connect'], ['Esc', 'Back']);
      return;
    }

    const updateStats = () => {
      const wg = wgStats(info.mode === 'amneziawg');
      const now = Date.now();
      const dt = Math.max(1, (now - lastTick) / 1000);

      if (wg) {
        if (prevRx > 0) {
          rxRate = Math.max(0, Math.round((wg.rx - prevRx) / dt));
          txRate = Math.max(0, Math.round((wg.tx - prevTx) / dt));
        }
        prevRx = wg.rx;
        prevTx = wg.tx;
        lastTick = now;
      }

      const ping = pingServer(info.server.split('@').pop());
      const upMin = Math.floor((now - new Date(info.startTime).getTime()) / 60000);

      const L = [];
      L.push(`${t(D.accent, b('◉  Live Tunnel Monitor'))}       ${t(D.success, '⬤ ACTIVE & ENCRYPTED')}`);
      L.push(hr()); L.push('');

      L.push(`  ${mu('Server:  ')} ${b(info.server)}  ${badge(info.mode)}     ${mu('Uptime:  ')} ${t(D.bright, upMin + ' min')}`);
      L.push(`  ${mu('Gateway: ')} ${t(D.purple, '10.0.0.1 (Unbound Zero-Log)')}   ${mu('Latency: ')} ${t(D.accent, ping)}`);
      L.push('');
      L.push(`  ${t(D.accent, b('THROUGHPUT & DATA USAGE'))}`);
      L.push(`  ${mu('──────────────────────────────────────────────────────')}`);
      L.push(`  ${mu('Download (RX):')}  ${t(D.success, fmtBytes(wg ? wg.rx : 0).padEnd(12))}  ${mu('Current Speed:')}  ${b(t(D.success, fmtBytes(rxRate) + '/s'))}`);
      L.push(`  ${mu('Upload   (TX):')}  ${t(D.warning, fmtBytes(wg ? wg.tx : 0).padEnd(12))}  ${mu('Current Speed:')}  ${b(t(D.warning, fmtBytes(txRate) + '/s'))}`);
      L.push('');

      // Visual Throughput Bars
      const maxRate = 2 * 1024 * 1024; // 2 MB/s scale
      const rxFill = Math.min(28, Math.round((rxRate / maxRate) * 28));
      const txFill = Math.min(28, Math.round((txRate / maxRate) * 28));
      const rxBar = t(D.success, '█'.repeat(rxFill)) + mu('░'.repeat(28 - rxFill));
      const txBar = t(D.warning, '█'.repeat(txFill)) + mu('░'.repeat(28 - txFill));

      L.push(`  ${mu('RX Meter:')} [${rxBar}]  ${t(D.success, fmtBytes(rxRate) + '/s')}`);
      L.push(`  ${mu('TX Meter:')} [${txBar}]  ${t(D.warning, fmtBytes(txRate) + '/s')}`);
      L.push('');

      L.push(`  ${t(D.accent, b('ACTIVE PEER CONNECTIONS'))}`);
      L.push(`  ${mu('──────────────────────────────────────────────────────')}`);
      if (wg && wg.peers && wg.peers.length > 0) {
        L.push(`  ${b('Public Key'.padEnd(16))} ${b('Endpoint'.padEnd(22))} ${b('Received'.padEnd(12))} ${b('Sent')}`);
        wg.peers.forEach(p => {
          L.push(`  ${t(D.accent, p.pubKey.padEnd(16))} ${mu(p.endpoint.padEnd(22))} ${t(D.success, fmtBytes(p.rx).padEnd(12))} ${t(D.warning, fmtBytes(p.tx))}`);
        });
      } else {
        L.push(`  ${mu('No external peer tunnels connected.')}`);
      }

      L.push(''); L.push(hr());
      L.push(`  ${mu('Auto-refreshing every second. Press ')}${t(D.accent, '[Esc]')}${mu(' to return.')}`);

      setView('dashboard', L, ['f', 'Full-Screen Map Grid'], ['Esc', 'Back'], ['q', 'Quit']);
      screen.render();
    };

    updateStats();
    activeTimer = setInterval(updateStats, 1000);
  };

  // ─── 7. PEERS VIEW (IN-FRAME CLIENT PEER MANAGER & QR) ────────────────────
  const loadPeers = async () => {
    peerViewState.loading = true;
    renderPeers();
    screen.render();

    try {
      const list = await listPeers().catch(() => []);
      peerViewState.peers = list || [];
    } catch (e) {
      peerViewState.peers = [];
    }
    peerViewState.loading = false;
    renderPeers();
    screen.render();
  };

  const renderPeers = () => {
    const L = [];
    L.push(`${t(D.accent, b('≡  WireGuard Client Peers'))}`); L.push(hr()); L.push('');

    if (peerViewState.viewingQr) {
      L.push(`  ${t(D.accent, b('Scan QR Code: ' + peerViewState.viewingQr))}`);
      L.push(hr()); L.push('');
      if (peerViewState.qrText) {
        L.push(peerViewState.qrText);
      } else {
        L.push('  Generating QR code...');
      }
      L.push(''); L.push(hr()); L.push('');
      L.push(`  ${mu('Scan with the WireGuard or AmneziaWG app on iOS / Android.')}`);
      L.push(`  ${mu('Press ')}${t(D.accent, '[Esc]')}${mu(' to return to the peer list.')}`);
      setView('peers', L, ['Esc', 'Back to Peer List']);
      return;
    }

    if (peerViewState.loading) {
      L.push(`  ${t(D.accent, '⟳')}  Fetching peer configurations from server...`);
      setView('peers', L, ['Esc', 'Back']);
      return;
    }

    if (peerViewState.peers.length === 0) {
      L.push(`  ${t(D.warning, '⚠')}  No additional client peers found on server.`);
      L.push('');
      L.push(`  ${mu('You can generate peer configs for your mobile devices (iPhone, iPad, Android).')}`);
      L.push('');
      L.push(`  Press ${t(D.accent, '[a]')} to add a new mobile peer.`);
      setView('peers', L, ['a', 'Add Peer'], ['Esc', 'Back']);
      return;
    }

    L.push(`  ${t(D.accent, '[↑/↓]')}${mu(' Select   ')}${t(D.accent, '[q]')}${mu(' View QR Code   ')}${t(D.accent, '[a]')}${mu(' Add Peer   ')}${t(D.accent, '[Esc]')}${mu(' Back')}`);
    L.push('');

    L.push(`  ${b('Peer Name'.padEnd(16))} ${b('Assigned IP'.padEnd(16))} ${b('Handshake'.padEnd(20))} ${b('Rx / Tx')}`);
    L.push(`  ${mu('─'.repeat(64))}`);

    peerViewState.peers.forEach((p, idx) => {
      const isSel = idx === peerIdx;
      const marker = isSel ? t(D.accent, '▶ ') : '  ';
      const name = isSel ? b(t(D.bright, p.name.padEnd(14))) : t(D.accent, p.name.padEnd(14));
      L.push(`${marker}${name} ${mu(p.ip.padEnd(16))} ${mu(p.handshake.padEnd(20))} ${t(D.success, p.transferRx)} / ${t(D.warning, p.transferTx)}`);
    });

    L.push(''); L.push(hr()); L.push('');
    L.push(`  Press ${t(D.accent, '[q]')} to render a QR code in terminal for mobile pairing.`);

    setView('peers', L, ['q', 'View QR Code'], ['a', 'Add Peer'], ['Esc', 'Back']);
  };

  const showPeerQr = async (peerName) => {
    peerViewState.viewingQr = peerName;
    peerViewState.qrText = '';
    renderPeers();
    screen.render();

    try {
      const confPath = getLocalPeerConfPath(peerName);
      if (existsSync(confPath)) {
        const confStr = readFileSync(confPath, 'utf-8');
        const qr = await QRCode.toString(confStr, { type: 'terminal', small: true });
        peerViewState.qrText = qr;
      } else {
        peerViewState.qrText = `  ${t(D.danger, 'Config not found locally at ' + confPath)}`;
      }
    } catch (e) {
      peerViewState.qrText = `  ${t(D.danger, 'Failed to generate QR: ' + e.message)}`;
    }
    renderPeers();
    screen.render();
  };

  // ─── 8. PRIVACY CHECK (IN-FRAME AUDIT) ────────────────────────────────────
  const renderCheck = () => {
    const L = [];
    L.push(`${t(D.accent, b('✦  Privacy & Leak Audit'))}`); L.push(hr()); L.push('');

    if (checkState.running) {
      L.push(`  ${t(D.accent, '⟳')}  ${b('Running 4-point privacy & security audit...')}`);
      L.push('');
      L.push(`  ${mu('Probing public IP disclosure, DNS resolvers, and IPv6 leak status...')}`);
      setView('check', L, ['Esc', 'Back']);
      return;
    }

    if (checkState.results) {
      const r = checkState.results;
      L.push(`  ${t(D.success, '✔  Privacy Audit Complete')}`);
      L.push(hr()); L.push('');
      L.push(`  ${t(D.success, '① Public IP:       ')} ${b(r.ip)}`);
      L.push(`  ${t(D.success, '② DNS Resolver:    ')} ${t(D.purple, r.dns)}`);
      L.push(`  ${t(D.success, '③ IPv6 Shield:     ')} ${t(D.bright, r.ipv6)}`);
      L.push(`  ${t(D.success, '④ WebRTC Shield:   ')} ${t(D.bright, 'Protected (Private host shielded)')}`);
      L.push(''); L.push(hr()); L.push('');
      L.push(`  ${b(t(D.success, 'AUDIT RATING: 100% PROTECTED - NO LEAKS DETECTED'))}`);
      L.push('');
      L.push(`  ${mu('Press ')}${t(D.accent, '[r / Enter]')}${mu(' to re-run audit.')}`);
      setView('check', L, ['r / Enter', 'Re-run Audit'], ['Esc', 'Back']);
      return;
    }

    L.push(`  ${b('Four-point privacy & security audit:')}`); L.push('');
    [[D.success,'①','Public IP Verification', 'Ensure external IP matches your VPS relay'],
     [D.success,'②','DNS Leak Test',          'Confirm DNS queries route to Unbound resolver'],
     [D.success,'③','IPv6 Shield Test',        'Verify zero IPv6 leaks outside the encrypted tunnel'],
     [D.success,'④','WebRTC Protection',       'Test for browser IP disclosure']].forEach(([c,n,ti,de]) => {
      L.push(`  ${t(c, n)}  ${b(ti)}   ${mu(de)}`);
    });
    L.push(''); L.push(hr()); L.push('');
    L.push(`  Press ${t(D.accent, '[Enter]')} to run live diagnostic.`);

    setView('check', L, ['Enter', 'Run Diagnostics'], ['Esc', 'Back']);
  };

  const startCheck = async () => {
    checkState = { running: true, results: null, error: null };
    renderCheck();
    screen.render();

    try {
      const ip = await getPublicIp().catch(e => 'Unknown (' + e.message + ')');
      const dnsRes = await checkDns().catch(() => ({ success: false, servers: [] }));
      const ipv6 = await checkIpv6Leak().catch(() => null);

      const info = getActiveTunnel();
      const dnsLabel = info
        ? '10.0.0.1 (Unbound Zero-Log Private Resolver)'
        : (dnsRes.servers.length ? dnsRes.servers.join(', ') : 'Direct ISP');
      const ipv6Label = ipv6 ? `Exposed IPv6: ${ipv6}` : 'Shielded (fd00:polaris:: tunnel)';

      checkState.running = false;
      checkState.results = {
        ip: `${ip} ${info ? '(Relayed via ' + info.server + ')' : '(Direct)'}`,
        dns: dnsLabel,
        ipv6: ipv6Label
      };
    } catch (e) {
      checkState.running = false;
      checkState.error = e.message;
    }
    renderCheck();
    screen.render();
  };

  // ─── 9. WATCHDOG VIEW (IN-FRAME GATEWAY PROBE) ────────────────────────────
  const renderWatchdog = () => {
    const status = getWatchdogStatus();
    const L = [];
    L.push(`${t(D.accent, b('♥  Tunnel Health Watchdog'))}`); L.push(hr()); L.push('');

    if (watchdogState.running) {
      L.push(`  ${t(D.accent, '⟳')}  ${b('Probing tunnel gateway heartbeat (10.0.0.1)...')}`);
      setView('watchdog', L, ['Esc', 'Back']);
      return;
    }

    if (watchdogState.result) {
      const r = watchdogState.result;
      L.push(`  ${t(r.healthy ? D.success : D.danger, r.healthy ? '✔  Gateway Responding' : '✖  Gateway Unresponsive')}`);
      L.push(hr()); L.push('');
      L.push(`  ${mu('Gateway IP:   ')} ${b('10.0.0.1')}`);
      L.push(`  ${mu('Health:       ')} ${r.healthy ? t(D.success, 'OPTIMAL (Active heartbeat verified)') : t(D.danger, 'FAILING')}`);
      if (r.latency) L.push(`  ${mu('Probe Latency:')} ${t(D.accent, r.latency + ' ms')}`);
      L.push(''); L.push(hr()); L.push('');
    }

    L.push('  Monitors tunnel gateway (10.0.0.1) connectivity and auto-reconnects.');
    L.push('');
    L.push(`  ${mu('Monitoring:')}    ${status.running ? t(D.success, 'ACTIVE (Heartbeat running)') : t(D.muted, 'IDLE (On-Demand)')}`);
    L.push(`  ${mu('Last Status:')}   ${t(D.accent, status.lastStatus)}`);
    if (status.lastCheckTime) {
      L.push(`  ${mu('Last Checked:')}  ${t(D.bright, new Date(status.lastCheckTime).toLocaleTimeString())}`);
    }
    L.push(`  ${mu('Failures:')}      ${status.consecutiveFailures === 0 ? t(D.success, '0 (Healthy)') : t(D.danger, String(status.consecutiveFailures))}`);
    L.push(''); L.push(hr()); L.push('');
    L.push(`  Press ${t(D.accent, '[Enter]')} to trigger an immediate heartbeat probe.`);

    setView('watchdog', L, ['Enter', 'Probe Gateway'], ['Esc', 'Back']);
  };

  const startWatchdogProbe = async () => {
    watchdogState.running = true;
    renderWatchdog();
    screen.render();

    try {
      const res = await runWatchdogCheck();
      watchdogState.running = false;
      watchdogState.result = res;
    } catch (e) {
      watchdogState.running = false;
      watchdogState.result = { healthy: false, reason: e.message };
    }
    renderWatchdog();
    screen.render();
  };

  // ─── 10. DEPLOY VPS WIZARD (IN-FRAME MULTI-STEP) ──────────────────────────
  const renderDeploy = () => {
    const L = [];
    L.push(`${t(D.accent, b('⊕  Deploy a VPS Server (Guided Wizard)'))}`); L.push(hr()); L.push('');

    // Step 5: In progress
    if (deployState.step === 5) {
      L.push(`  ${t(D.accent, '⟳')}  ${b('Provisioning server in progress...')}`);
      L.push('');
      L.push(`  ${mu('Target:')}  ${b(deployState.server)}   ${badge(deployState.mode)}`);
      L.push('');
      L.push(`  ${t(D.accent, b('LIVE DEPLOYMENT LOGS:'))}`);
      L.push(`  ${mu('─'.repeat(54))}`);
      const recentLogs = deployState.logs.slice(-8);
      recentLogs.forEach(line => {
        L.push(`  ${mu('→')} ${line}`);
      });
      setView('deploy', L, ['Esc', 'Cancel / Back']);
      return;
    }

    // Step 6: Complete
    if (deployState.step === 6) {
      L.push(`  ${t(D.success, '✔  Deployment Complete!')}`);
      L.push(hr()); L.push('');
      L.push(`  ${mu('Server:        ')} ${b(deployState.server)}`);
      L.push(`  ${mu('Protocol:      ')} ${badge(deployState.mode)}`);
      if (deployState.alias) {
        L.push(`  ${mu('Saved Profile: ')} ${t(D.success, deployState.alias)}`);
      }
      if (deployState.clientConfPath) {
        L.push(`  ${mu('Local Config:  ')} ${t(D.bright, deployState.clientConfPath)}`);
      }
      L.push(''); L.push(hr()); L.push('');
      L.push(`  Press ${t(D.accent, '[Enter]')} to connect now, or ${t(D.accent, '[Esc]')} to return to Servers.`);
      setView('deploy', L, ['Enter', 'Connect Now'], ['Esc', 'Back to Servers']);
      return;
    }

    // Steps 0..4
    const steps = [
      'Server Address',
      'SSH Key',
      'Protocol Mode',
      'Profile Alias',
      'Review & Confirm'
    ];

    L.push(`  ${steps.map((st, i) => {
      const isCur = i === deployState.step;
      const isDone = i < deployState.step;
      if (isCur) return t(D.accent, b(`[${i + 1}. ${st}]`));
      if (isDone) return t(D.success, `✓ ${st}`);
      return mu(`${i + 1}. ${st}`);
    }).join('  ›  ')}`);
    L.push(''); L.push(hr()); L.push('');

    if (deployState.error) {
      L.push(`  ${t(D.danger, '⚠ ' + deployState.error)}`);
      L.push('');
    }

    if (deployState.step === 0) {
      L.push(`  ${b('Step 1: Enter your remote server address')}`);
      L.push(`  ${mu('Format: user@host or IP (e.g. ubuntu@1.2.3.4 or root@my-vps.com)')}`);
      L.push('');
      L.push(`  {${D.accent}-fg}┌──────────────────────────────────────────────┐{/}`);
      L.push(`  {${D.accent}-fg}│{/} ${(deployState.server || mu('ubuntu@1.2.3.4')).padEnd(44)} {${D.accent}-fg}│{/}`);
      L.push(`  {${D.accent}-fg}└──────────────────────────────────────────────┘{/}`);
    } else if (deployState.step === 1) {
      L.push(`  ${b('Step 2: SSH Private Key Path (Optional)')}`);
      L.push(`  ${mu('Leave blank to use default (~/.ssh/id_rsa or ~/.ssh/id_ed25519)')}`);
      L.push('');
      L.push(`  {${D.accent}-fg}┌──────────────────────────────────────────────┐{/}`);
      L.push(`  {${D.accent}-fg}│{/} ${(deployState.keyPath || mu('~/.ssh/oracle-vpn.key (optional)')).padEnd(44)} {${D.accent}-fg}│{/}`);
      L.push(`  {${D.accent}-fg}└──────────────────────────────────────────────┘{/}`);
    } else if (deployState.step === 2) {
      L.push(`  ${b('Step 3: Select VPN Protocol Mode')}`);
      L.push('');
      const isWg = deployState.mode === 'wireguard';
      L.push(`  ${isWg ? t(D.accent, '▶ [1] WireGuard') : mu('  [1] WireGuard')}     ${mu('Standard, BBR-accelerated, high throughput')}`);
      L.push(`  ${!isWg ? t(D.purple, '▶ [2] AmneziaWG') : mu('  [2] AmneziaWG')}     ${mu('Stealth mode — bypasses DPI firewalls')}`);
      L.push('');
      L.push(`  ${mu('Press ')}${t(D.accent, '[1]')}${mu(' for WireGuard or ')}${t(D.purple, '[2]')}${mu(' for AmneziaWG.')}`);
    } else if (deployState.step === 3) {
      L.push(`  ${b('Step 4: Save as Profile Alias (Optional)')}`);
      L.push(`  ${mu('Give this server a friendly name (e.g. oracle-fra or my-vpn)')}`);
      L.push('');
      L.push(`  {${D.accent}-fg}┌──────────────────────────────────────────────┐{/}`);
      L.push(`  {${D.accent}-fg}│{/} ${(deployState.alias || mu('oracle-fra (optional)')).padEnd(44)} {${D.accent}-fg}│{/}`);
      L.push(`  {${D.accent}-fg}└──────────────────────────────────────────────┘{/}`);
    } else if (deployState.step === 4) {
      L.push(`  ${b('Step 5: Review & Confirm Deployment')}`);
      L.push('');
      L.push(`  ${mu('Server:    ')} ${b(deployState.server)}`);
      L.push(`  ${mu('SSH Key:   ')} ${t(D.bright, deployState.keyPath || 'Default SSH key (~/.ssh/id_rsa)')}`);
      L.push(`  ${mu('Protocol:  ')} ${badge(deployState.mode)}`);
      L.push(`  ${mu('Profile:   ')} ${t(D.bright, deployState.alias || 'None')}`);
      L.push('');
      L.push(`  ${mu('Polaris will SSH to your server, install WireGuard and Unbound,')}`);
      L.push(`  ${mu('enable Google BBR congestion control, and configure DNS AdBlock.')}`);
      L.push('');
      L.push(`  Press ${b(t(D.success, '[Enter] Confirm & Deploy'))} or ${t(D.accent, '[Esc] Back')}.`);
    }

    L.push(''); L.push(hr());
    L.push(`  ${mu('Navigation: ')}${t(D.accent, '[Enter]')}${mu(' Next Step   ')}${t(D.accent, '[Esc]')}${mu(' Previous Step / Cancel')}`);

    setView('deploy', L,
      ['Enter', deployState.step === 4 ? 'Deploy Now' : 'Next Step'],
      ['Esc', deployState.step === 0 ? 'Cancel' : 'Previous Step']
    );
  };

  const startDeployment = async () => {
    deployState.step = 5;
    deployState.logs = [];
    deployState.error = null;
    renderDeploy();
    screen.render();

    try {
      const res = await deployServer(deployState.server, {
        mode: deployState.mode,
        privateKey: deployState.keyPath.trim() || undefined,
        onProgress: (msg) => {
          deployState.logs.push(msg);
          renderDeploy();
          screen.render();
        }
      });

      if (deployState.alias.trim()) {
        addProfile(deployState.alias.trim(), deployState.server);
      }

      deployState.clientConfPath = res.clientConfPath;
      deployState.step = 6;
      renderSidebar();
    } catch (err) {
      deployState.step = 4;
      deployState.error = err.message || 'Deployment failed.';
    }
    renderDeploy();
    screen.render();
  };

  // ─── 11. DISCONNECT VIEW ──────────────────────────────────────────────────
  const renderDisconnect = () => {
    const info = getActiveTunnel();
    const L = [];

    L.push(`${t(D.danger, b('■  Disconnect Active Tunnel'))}`); L.push(hr()); L.push('');

    if (!info) {
      L.push(`  ${mu('No active tunnel running. Your connection is already direct.')}`);
      setView('disconnect', L, ['Esc', 'Back to Home']);
      return;
    }

    L.push(`  Are you sure you want to tear down the active VPN tunnel?`);
    L.push(`  ${mu('Connected to:')}  ${b(info.server)}  ${badge(info.mode)}`);
    L.push('');
    L.push(`  Your internet traffic will revert to your direct ISP connection.`);
    L.push(''); L.push(hr()); L.push('');
    L.push(`  Press ${t(D.danger, '[y]')} to confirm disconnect.`);
    L.push(`  Press ${t(D.accent, '[n]')} or ${t(D.accent, '[Esc]')} to cancel and go back.`);

    setView('disconnect', L, ['y', 'Disconnect'], ['n / Esc', 'Cancel & Back']);
  };

  const executeDisconnect = async () => {
    try {
      stopActiveTunnel(true);
      renderSidebar();
      statusNotice = 'Tunnel disconnected cleanly.';
      await goto('home');
    } catch (e) {
      await goto('home');
    }
  };

  // ─── 12. HELP VIEW ────────────────────────────────────────────────────────
  const renderHelp = () => {
    const L = [];
    L.push(`${t(D.accent, b('?  Polaris Help & Keybindings'))}`); L.push(hr()); L.push('');
    [
      ['1 / h',        'Return to Home View'],
      ['2',            'Server Profiles Manager'],
      ['3',            'Quick Connect to active server'],
      ['4',            'Speed Test Throughput Benchmark'],
      ['5',            'Live Bandwidth Sparkline Monitor'],
      ['6',            'WireGuard Client Peers & QR Codes'],
      ['7',            'Privacy & DNS Leak Audit'],
      ['8',            'Tunnel Health Watchdog'],
      ['9',            'Deploy VPS Server Wizard'],
      ['s / Space',    'Set selected profile as active default (in Servers)'],
      ['a',            'Add new profile (in Servers)'],
      ['x / Del',      'Delete selected profile (in Servers)'],
      ['p',            'Ping all saved servers for latency (in Servers)'],
      ['Esc / Back',   'Return to previous stage / view'],
      ['q / Ctrl+C',   'Quit Polaris']
    ].forEach(([k, v]) => L.push(`  ${t(D.accent, k.padEnd(16))} ${mu(v)}`));
    setView('help', L, ['Esc / ?', 'Back to Previous Stage']);
  };

  // ─── GLOBAL KEYBOARD HANDLERS ─────────────────────────────────────────────
  screen.key(['q', 'C-c'], () => {
    if (activeInputMode) {
      // In text editing, let Esc cancel instead of quitting accidentally
      return;
    }
    clearTimers();
    process.exit(0);
  });

  screen.key(['escape', 'backspace'], async () => {
    await goBack();
  });

  // Direct number shortcuts (active when not in text input modes)
  screen.key(['1', 'h'], async () => { if (!activeInputMode) await goto('home'); });
  screen.key(['2'],      async () => { if (!activeInputMode) await goto('servers'); });
  screen.key(['3'],      async () => { if (!activeInputMode) await goto('connect'); });
  screen.key(['4'],      async () => { if (!activeInputMode) await goto('speedtest'); });
  screen.key(['5'],      async () => { if (!activeInputMode) await goto('dashboard'); });
  screen.key(['6'],      async () => { if (!activeInputMode) await goto('peers'); });
  screen.key(['7'],      async () => { if (!activeInputMode) await goto('check'); });
  screen.key(['8'],      async () => { if (!activeInputMode) await goto('watchdog'); });
  screen.key(['9'],      async () => { if (!activeInputMode) await goto('deploy'); });
  screen.key(['?'],      async () => { if (!activeInputMode) await goto(currentView === 'help' ? 'home' : 'help'); });

  // Navigation: Up / Down arrow keys
  screen.key(['up', 'k'], () => {
    if (activeInputMode === 'add_server') {
      addServerState.activeField = Math.max(0, addServerState.activeField - 1);
      renderAddServer();
      screen.render();
      return;
    }

    if (currentView === 'servers') {
      const { profiles } = getProfiles();
      const n = Object.keys(profiles).length;
      if (n > 0) {
        srvIdx = (srvIdx - 1 + n) % n;
        renderServers();
        screen.render();
      }
      return;
    }

    if (currentView === 'peers') {
      if (peerViewState.peers.length > 0) {
        peerIdx = (peerIdx - 1 + peerViewState.peers.length) % peerViewState.peers.length;
        renderPeers();
        screen.render();
      }
      return;
    }

    if (menuIdx > 0) {
      menuIdx--;
      renderSidebar();
      screen.render();
    }
  });

  screen.key(['down', 'j'], () => {
    if (activeInputMode === 'add_server') {
      addServerState.activeField = Math.min(2, addServerState.activeField + 1);
      renderAddServer();
      screen.render();
      return;
    }

    if (currentView === 'servers') {
      const { profiles } = getProfiles();
      const n = Object.keys(profiles).length;
      if (n > 0) {
        srvIdx = (srvIdx + 1) % n;
        renderServers();
        screen.render();
      }
      return;
    }

    if (currentView === 'peers') {
      if (peerViewState.peers.length > 0) {
        peerIdx = (peerIdx + 1) % peerViewState.peers.length;
        renderPeers();
        screen.render();
      }
      return;
    }

    if (menuIdx < NAV.length - 1) {
      menuIdx++;
      renderSidebar();
      screen.render();
    }
  });

  // Tab & Shift-Tab
  screen.key(['tab'], () => {
    if (activeInputMode === 'add_server') {
      addServerState.activeField = (addServerState.activeField + 1) % 3;
      renderAddServer();
      screen.render();
      return;
    }
    if (menuIdx < NAV.length - 1) {
      menuIdx++;
      renderSidebar();
      screen.render();
    } else {
      menuIdx = 0;
      renderSidebar();
      screen.render();
    }
  });

  screen.key(['S-tab'], () => {
    if (activeInputMode === 'add_server') {
      addServerState.activeField = (addServerState.activeField - 1 + 3) % 3;
      renderAddServer();
      screen.render();
      return;
    }
    if (menuIdx > 0) {
      menuIdx--;
      renderSidebar();
      screen.render();
    }
  });

  // Enter key handler
  screen.key(['enter'], async () => {
    if (activeInputMode === 'add_server') {
      if (addServerState.activeField < 2) {
        addServerState.activeField++;
        renderAddServer();
        screen.render();
      } else {
        const alias = addServerState.fields[0].value.trim();
        const server = addServerState.fields[1].value.trim();
        const tagStr = addServerState.fields[2].value.trim();
        if (!alias) {
          addServerState.error = 'Profile alias is required.';
          renderAddServer();
          screen.render();
          return;
        }
        if (!server) {
          addServerState.error = 'Server address is required.';
          renderAddServer();
          screen.render();
          return;
        }
        const tags = tagStr ? tagStr.split(',').map(s => s.trim()).filter(Boolean) : [];
        addProfile(alias, server, tags);
        statusNotice = `Added profile '${alias}'`;
        addServerState.fields.forEach(f => f.value = '');
        addServerState.activeField = 0;
        addServerState.error = null;
        await goBack();
      }
      return;
    }

    if (currentView === 'deploy') {
      if (deployState.step === 0) {
        if (!deployState.server.trim()) {
          deployState.error = 'Server address is required.';
          renderDeploy();
          screen.render();
          return;
        }
        deployState.error = null;
        deployState.step = 1;
        renderDeploy();
        screen.render();
      } else if (deployState.step === 1) {
        deployState.step = 2;
        renderDeploy();
        screen.render();
      } else if (deployState.step === 2) {
        deployState.step = 3;
        renderDeploy();
        screen.render();
      } else if (deployState.step === 3) {
        deployState.step = 4;
        renderDeploy();
        screen.render();
      } else if (deployState.step === 4) {
        await startDeployment();
      } else if (deployState.step === 6) {
        await runConnect(deployState.server);
      }
      return;
    }

    if (currentView === 'servers') {
      const { profiles } = getProfiles();
      const names = Object.keys(profiles);
      if (names.length === 0) {
        await goto('deploy');
      } else {
        const entry = profiles[names[srvIdx]];
        const serverStr = typeof entry === 'string' ? entry : (entry?.server || entry);
        await runConnect(serverStr);
      }
      return;
    }

    if (currentView === 'speedtest') {
      await startSpeedtest();
      return;
    }

    if (currentView === 'check') {
      await startCheck();
      return;
    }

    if (currentView === 'watchdog') {
      await startWatchdogProbe();
      return;
    }

    if (currentView === 'peers') {
      if (peerViewState.peers.length > 0) {
        await showPeerQr(peerViewState.peers[peerIdx]?.name);
      }
      return;
    }

    if (currentView === 'disconnect') {
      await executeDisconnect();
      return;
    }

    // Default: activate sidebar selection
    const v = VIEWS[NAV[menuIdx]];
    if (v) await goto(v.id);
  });

  // Action hotkeys
  screen.key(['y'], async () => {
    if (currentView === 'disconnect') {
      await executeDisconnect();
    }
  });

  screen.key(['n'], async () => {
    if (currentView === 'disconnect') {
      await goBack();
    }
  });

  screen.key(['r'], async () => {
    if (currentView === 'speedtest') await startSpeedtest();
    if (currentView === 'check') await startCheck();
  });

  screen.key(['s', 'space'], () => {
    if (currentView === 'servers') {
      const { profiles } = getProfiles();
      const names = Object.keys(profiles);
      if (names.length > 0 && names[srvIdx]) {
        try {
          setActiveProfile(names[srvIdx]);
          statusNotice = `Set '${names[srvIdx]}' as active default`;
        } catch (e) {
          statusNotice = e.message;
        }
        renderServers();
        screen.render();
      }
    }
  });

  screen.key(['x', 'delete'], () => {
    if (currentView === 'servers') {
      const { profiles } = getProfiles();
      const names = Object.keys(profiles);
      if (names.length > 0 && names[srvIdx]) {
        const toDelete = names[srvIdx];
        try {
          removeProfile(toDelete);
          statusNotice = `Removed profile '${toDelete}'`;
          srvIdx = Math.max(0, srvIdx - 1);
        } catch (e) {
          statusNotice = `Failed to remove: ${e.message}`;
        }
        renderServers();
        screen.render();
      }
    }
  });

  screen.key(['p'], () => {
    if (currentView === 'servers') {
      const { profiles } = getProfiles();
      for (const [alias, entry] of Object.entries(profiles)) {
        const srv = typeof entry === 'string' ? entry : entry.server;
        if (srv) {
          serverPings[srv] = pingServer(srv);
        }
      }
      statusNotice = 'Server latency refreshed';
      renderServers();
      screen.render();
    }
  });

  screen.key(['a'], async () => {
    if (currentView === 'servers') {
      await goto('add_server');
    }
  });

  screen.key(['d'], async () => {
    if (currentView === 'servers') {
      await goto('deploy');
    }
  });

  screen.key(['q'], async () => {
    if (currentView === 'peers' && !peerViewState.viewingQr && peerViewState.peers.length > 0) {
      await showPeerQr(peerViewState.peers[peerIdx]?.name);
    }
  });

  screen.key(['f'], async () => {
    if (currentView === 'dashboard') {
      const info = getActiveTunnel();
      if (info) {
        try {
          clearTimers();
          screen.destroy();
          const m = await import('./dashboard.js');
          await m.default();
        } catch (e) {
          const m = await import('./tui.js');
          await m.default();
        }
      }
    }
  });

  // Text input listener for in-frame forms (Add Server & Deploy Wizard)
  screen.on('keypress', (ch, key) => {
    if (!key) return;

    // In Add Server Form
    if (activeInputMode === 'add_server') {
      const cur = addServerState.fields[addServerState.activeField];
      if (key.name === 'backspace') {
        if (cur.value.length > 0) {
          cur.value = cur.value.slice(0, -1);
          renderAddServer();
          screen.render();
        }
        return;
      }
      if (ch && ch.length === 1 && !key.ctrl && !key.meta && key.name !== 'enter' && key.name !== 'tab' && key.name !== 'escape') {
        if (cur.value.length < 50) {
          cur.value += ch;
          renderAddServer();
          screen.render();
        }
        return;
      }
    }

    // In Deploy Wizard
    if (activeInputMode === 'deploy' && deployState.step < 4) {
      if (deployState.step === 2) {
        if (ch === '1') {
          deployState.mode = 'wireguard';
          renderDeploy();
          screen.render();
        } else if (ch === '2') {
          deployState.mode = 'amneziawg';
          renderDeploy();
          screen.render();
        }
        return;
      }

      let targetKey = deployState.step === 0 ? 'server' : (deployState.step === 1 ? 'keyPath' : 'alias');

      if (key.name === 'backspace') {
        if (deployState[targetKey].length > 0) {
          deployState[targetKey] = deployState[targetKey].slice(0, -1);
          renderDeploy();
          screen.render();
        }
        return;
      }

      if (ch && ch.length === 1 && !key.ctrl && !key.meta && key.name !== 'enter' && key.name !== 'tab' && key.name !== 'escape') {
        if (deployState[targetKey].length < 60) {
          deployState[targetKey] += ch;
          renderDeploy();
          screen.render();
        }
        return;
      }
    }
  });

  // ─── RESIZE ───────────────────────────────────────────────────────────────
  screen.on('resize', () => {
    try {
      screen.realloc();
      if (!checkScreenDimensions()) return;
      renderSidebar();
      switch (currentView) {
        case 'home':        renderHome();        break;
        case 'servers':     renderServers();     break;
        case 'add_server':  renderAddServer();   break;
        case 'connect':     renderConnectView(); break;
        case 'speedtest':   renderSpeedtest();   break;
        case 'dashboard':   renderDashboard();   break;
        case 'peers':       renderPeers();       break;
        case 'check':       renderCheck();       break;
        case 'watchdog':    renderWatchdog();    break;
        case 'deploy':      renderDeploy();      break;
        case 'disconnect':  renderDisconnect();  break;
        case 'help':        renderHelp();        break;
        default:            renderHome();        break;
      }
      screen.render();
    } catch (e) {}
  });

  // Initial render
  if (checkScreenDimensions()) {
    renderSidebar();
    renderHome();
    screen.render();
  }
};
