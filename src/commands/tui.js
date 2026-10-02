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
const hr = (n = 48) => t(D.sep, '─'.repeat(n));

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

// ─── NAVIGATION STRUCTURE ─────────────────────────────────────────────────────
const VIEWS = [
  { id: 'home',       label: 'Home',          icon: '◈' },
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
  const k = 1024, s = ['B', 'KB', 'MB', 'GB'];
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
    for (let i = 1; i < lines.length; i++) {
      const p = lines[i].split('\t');
      rx += parseInt(p[6], 10) || 0;
      tx += parseInt(p[7], 10) || 0;
    }
    return { rx, tx };
  } catch (e) {
    return null;
  }
};

// ─── MAIN TUI ────────────────────────────────────────────────────────────────
export default async () => {
  const { getActiveTunnel } = await import('../core/tunnel-service.js');
  const { getProfiles, setActiveProfile, removeProfile, addProfile } = await import('../core/profile-service.js');
  const { getWatchdogStatus } = await import('../core/watchdog-service.js');

  // ─── APP STATE ────────────────────────────────────────────────────
  let menuIdx     = 0;   // index into NAV array
  let currentView = 'home';
  let srvIdx      = 0;   // selected server in Servers view
  let serverPings = {};  // cache for server pings
  let statusNotice = null;

  // ─── SCREEN ───────────────────────────────────────────────────────
  const screen = blessed.screen({
    smartCSR:    true,
    title:       `Polaris VPN  v${pkg.version}`,
    fullUnicode: true,
    dockBorders: false,
    ignoreLocked: ['C-c'],
  });

  // ─── WIDGETS ──────────────────────────────────────────────────────
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

  // Main content panel
  const wMain = blessed.box({
    parent: screen,
    top: HEADER_H + 1, left: SIDEBAR_W, right: 0, bottom: FOOTER_H,
    tags: true,
    scrollable: false,
    border: { type: 'line' },
    style: { border: { fg: D.accentDim }, bg: D.bg, fg: D.text },
    padding: { left: 3, right: 3, top: 1, bottom: 1 },
  });

  // Footer
  const wFooter = blessed.box({
    parent: screen,
    bottom: 0, left: 0, width: '100%', height: FOOTER_H,
    tags: true, content: '',
    border: { type: 'line' },
    style: { border: { fg: D.sep }, bg: D.bg },
    padding: { left: 1 },
  });

  // Small screen overlay protection
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
        `  ${mu('Or press ')}${t(D.accent, '[q]')}${mu(' to exit and use direct CLI commands (e.g. polaris status).')}`
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

  // ─── RENDER HELPERS ───────────────────────────────────────────────
  const setFooter = (...pairs) => {
    wFooter.setContent(
      '  ' + pairs.map(([k, v]) => `${t(D.accent, b(`[${k}]`))} ${mu(v)}`).join('   ')
    );
  };

  const defaultFooter = () => setFooter(
    ['Tab / ↑↓', 'Navigate'],
    ['Enter', 'Select'],
    ['?', 'Help'],
    ['q', 'Quit']
  );

  const setView = (id, lines, ...footerPairs) => {
    const v = VIEWS.find(x => x && x.id === id);
    const lbl = v ? `${v.icon}  ${v.label.toUpperCase()}` : id.toUpperCase();
    wMain.setLabel(`{${D.accent}-fg} ${lbl} {/}`);
    wMain.setContent('\n' + (Array.isArray(lines) ? lines.join('\n') : lines));
    if (wMain.scrollTo) wMain.scrollTo(0);
    footerPairs.length ? setFooter(...footerPairs) : defaultFooter();
  };

  // ─── SIDEBAR RENDERER ─────────────────────────────────────────────
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
      const isSel      = i === selectedViewsIdx;
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

  // ─── CONTENT VIEWS ────────────────────────────────────────────────
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
      L.push(`  ${mu('Go to ')}${t(D.accent, 'Live Monitor')}${mu(' for real-time throughput sparklines.')}`);
      L.push(`  ${mu('Go to ')}${t(D.accent, 'Speed Test')}${mu(' to test current download bandwidth.')}`);
      L.push(`  ${mu('Go to ')}${t(D.danger, 'Disconnect')}${mu(' to cleanly shut down the tunnel.')}`);
    } else {
      const { profiles, active } = getProfiles();
      const names = Object.keys(profiles);
      L.push(`${t(D.accent, b('◈  Welcome to Polaris VPN'))}`);
      L.push(hr()); L.push('');
      L.push(`  ${t(D.danger, '○')}  ${b(t(D.muted, 'No active tunnel running.'))}`); L.push('');
      if (names.length > 0) {
        L.push(`  ${t(D.accent, b('Saved Server Profiles'))}`); L.push('');
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
        L.push(`  ${mu('Press ')}${t(D.accent, '[Enter]')}${mu(' on ')}${t(D.accent, 'Quick Connect')}${mu(' to connect to active server.')}`);
        L.push(`  ${mu('Press ')}${t(D.accent, '[2]')}${mu(' for Server Manager to switch, add, or delete profiles.')}`);
      } else {
        L.push(`  ${t(D.warning, '⚠')}  ${mu('No server profiles saved yet.')}`); L.push('');
        L.push(`  ${mu('Deploy a new VPS:  press ')}${t(D.accent, '[9]')}${mu(' or select ')}${t(D.accent, 'Deploy VPS')}`);
        L.push(`  ${mu('Or add an existing server: press ')}${t(D.accent, '[2]')}${mu(' and press ')}${t(D.accent, '[a]')}`);
      }
    }
    setView('home', L);
  };

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
      L.push(`  ${t(D.accent, '[a]')}${mu(' Add new profile   ')}${t(D.accent, '[d]')}${mu(' Launch Deploy VPS wizard')}`);
    } else {
      L.push(`  ${t(D.accent, '[↑/↓]')}${mu(' Select   ')}${t(D.accent, '[Enter]')}${mu(' Connect   ')}${t(D.accent, '[s]')}${mu(' Set Active   ')}${t(D.accent, '[x]')}${mu(' Delete   ')}${t(D.accent, '[a]')}${mu(' Add')}`);
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

        // Validation check on server host
        const isValid = srv.includes('@') || srv.includes('.') || srv === 'localhost';
        const validBadge = isValid ? '' : `  ${t(D.danger, '⚠ Invalid Host')}`;

        L.push(`  ${cur} ${name}${pill}${tags}${ping}${validBadge}`);
        L.push(`     ${mu(srv)}`);
        L.push('');
      });

      L.push(hr());
      L.push(`  ${mu('Selected Profile: ')}${t(D.accent, names[srvIdx] || '—')}`);
    }
    setView('servers', L, ['Enter', 'Connect'], ['s', 'Set Default'], ['x', 'Delete'], ['a', 'Add'], ['Esc', 'Back']);
  };

  const renderSpeedtest = () => {
    const L = [];
    L.push(`${t(D.accent, b('⚡  VPN Speedtest Benchmark'))}`); L.push(hr()); L.push('');
    L.push('  Measures real-time throughput and latency through the active connection.');
    L.push('');
    L.push(`  ${mu('Test payload:')}  ${t(D.bright, '10 MB high-capacity CDN payload')}`);
    L.push(`  ${mu('Metrics:')}       ${t(D.bright, 'Ping, Jitter, Download Mbps, Streaming Rating')}`);
    L.push(''); L.push(hr()); L.push('');
    L.push(`  Press ${t(D.accent, '[Enter]')} to run benchmark.`);
    setView('speedtest', L, ['Enter', 'Start Benchmark'], ['Esc', 'Back']);
  };

  const renderWatchdog = () => {
    const status = getWatchdogStatus();
    const L = [];
    L.push(`${t(D.accent, b('♥  Tunnel Health Watchdog'))}`); L.push(hr()); L.push('');
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
    setView('watchdog', L, ['Enter', 'Check Gateway'], ['Esc', 'Back']);
  };

  const renderCheck = () => {
    const L = [];
    L.push(`${t(D.accent, b('✦  Privacy & Leak Check'))}`); L.push(hr()); L.push('');
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

  const renderDeploy = () => {
    const L = [];
    L.push(`${t(D.accent, b('⊕  Deploy a VPS Server'))}`); L.push(hr()); L.push('');
    L.push('  Provisions any Linux VPS (Oracle Cloud, AWS, DigitalOcean, Hetzner)');
    L.push('  with WireGuard/AmneziaWG, BBR Congestion Control, and Unbound AdBlock.');
    L.push(''); L.push(hr()); L.push('');
    L.push(`  ${t(D.accent, b('What you need'))}`); L.push('');
    L.push(`  ${t(D.success, '①')}  A Linux VPS (Ubuntu, Debian, Oracle Linux, Rocky, CentOS)`);
    L.push(`  ${t(D.success, '②')}  SSH access (username & password or SSH identity key)`);
    L.push(`  ${t(D.success, '③')}  UDP port 51820 allowed in cloud firewall (VCN security list)`);
    L.push(''); L.push(hr()); L.push('');
    L.push(`  Press ${t(D.accent, '[Enter]')} to launch the interactive Deploy Wizard.`);
    setView('deploy', L, ['Enter', 'Launch Wizard'], ['Esc', 'Back']);
  };

  const renderPeers = () => {
    const L = [];
    L.push(`${t(D.accent, b('≡  WireGuard Client Peers'))}`); L.push(hr()); L.push('');
    L.push('  Manage multi-device client configs and QR codes for iPhone & Android.');
    L.push(''); L.push(hr()); L.push('');
    L.push(`  Press ${t(D.accent, '[Enter]')} to inspect active peer configs and generate QR codes.`);
    setView('peers', L, ['Enter', 'Manage Peers'], ['Esc', 'Back']);
  };

  const renderDisconnect = () => {
    const L = [];
    L.push(`${t(D.danger, b('■  Disconnect Active Tunnel'))}`); L.push(hr()); L.push('');
    L.push('  Are you sure you want to tear down the active VPN tunnel?');
    L.push('  Your internet traffic will revert to your direct ISP connection.');
    L.push(''); L.push(hr()); L.push('');
    L.push(`  Press ${t(D.danger, '[y]')} to confirm disconnect.`);
    L.push(`  Press ${t(D.accent, '[n]')} or ${t(D.accent, '[Esc]')} to cancel.`);
    setView('disconnect', L, ['y', 'Disconnect'], ['n / Esc', 'Cancel']);
  };

  const renderHelp = () => {
    const L = [];
    L.push(`${t(D.accent, b('?  Polaris Help & Keybindings'))}`); L.push(hr()); L.push('');
    [
      ['1 / h / m',   'Return to Home View'],
      ['2',           'Server Profiles Manager'],
      ['3',           'Quick Connect to default server'],
      ['4',           'Speed Test Throughput Benchmark'],
      ['5',           'Live Bandwidth Sparkline Monitor'],
      ['6',           'Peers & Mobile QR Codes'],
      ['7',           'Privacy & DNS Leak Test'],
      ['8',           'Tunnel Health Watchdog'],
      ['9',           'Deploy New Cloud VPS'],
      ['s / Space',   'Set highlighted profile as active default (in Servers)'],
      ['x / Del',     'Delete highlighted profile (in Servers)'],
      ['a',           'Add a new server profile (in Servers)'],
      ['p',           'Ping all server profiles (in Servers)'],
      ['Esc',         'Back to Home'],
      ['q / Ctrl+C',  'Quit Polaris']
    ].forEach(([k, v]) => L.push(`  ${t(D.accent, k.padEnd(16))} ${mu(v)}`));
    setView('help', L, ['Esc / ?', 'Close Help']);
  };

  const renderErrorView = (title, message) => {
    const L = [];
    L.push(`${t(D.danger, b(`⚠  ${title}`))}`); L.push(hr()); L.push('');
    L.push(`  ${t(D.danger, '✖')}  ${b(message)}`); L.push(''); L.push(hr()); L.push('');
    L.push(`  Press ${t(D.accent, '[Esc]')} to return to Home.`);
    setView('error', L, ['Esc', 'Return Home']);
  };

  // ─── SUSPEND + RUN COMMAND ────────────────────────────────────────
  const runCmd = async (fn) => {
    try { screen.destroy(); } catch (e) {}
    process.stdout.write('\x1b[2J\x1b[H');
    console.log(`\x1b[36m\n  Polaris VPN \x1b[0m\x1b[90m— executing...\x1b[0m\n`);
    try {
      await fn();
    } catch (err) {
      console.error('\n\x1b[31m  Error:\x1b[0m', err.message);
    }
    console.log('\n\x1b[90m  ─────────────────────────────────\x1b[0m');
    console.log('\x1b[36m  Press any key to return to main menu...\x1b[0m');
    try {
      await new Promise(resolve => {
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(true);
          process.stdin.resume();
          const onData = () => {
            try {
              process.stdin.removeListener('data', onData);
              process.stdin.setRawMode(false);
              process.stdin.pause();
            } catch (e) {}
            resolve();
          };
          process.stdin.on('data', onData);
        } else {
          resolve();
        }
      });
    } catch (e) {}
    try {
      const m = await import('./tui.js');
      await m.default();
    } catch (err) {
      console.error('Failed to restore TUI:', err.message);
      process.exit(1);
    }
  };

  // ─── ACTIVATE A VIEW ──────────────────────────────────────────────
  const goto = async (viewId) => {
    try {
      currentView = viewId;

      const vi = VIEWS.findIndex(v => v && v.id === viewId);
      const ni = NAV.indexOf(vi);
      if (ni !== -1) menuIdx = ni;

      renderSidebar();
      screen.render();

      if (viewId === 'connect') {
        await runCmd(async () => {
          const run = (await import('./start.js')).default;
          await run({ mode: 'auto', json: false });
        });
        return;
      }
      if (viewId === 'dashboard') {
        const info = getActiveTunnel();
        if (!info) {
          renderErrorView('Live Monitor Unavailable', 'No active tunnel running. Please connect to a server first before launching Live Monitor.');
          screen.render();
          return;
        }
        try {
          screen.destroy();
          const m = await import('./dashboard.js');
          await m.default();
        } catch (err) {
          const m = await import('./tui.js');
          await m.default();
        }
        return;
      }
      if (viewId === 'quit') { process.exit(0); }

      switch (viewId) {
        case 'home':       renderHome();       break;
        case 'servers':    srvIdx = 0; renderServers(); break;
        case 'speedtest':  renderSpeedtest();  break;
        case 'watchdog':   renderWatchdog();   break;
        case 'check':      renderCheck();      break;
        case 'deploy':     renderDeploy();     break;
        case 'peers':      renderPeers();      break;
        case 'disconnect': renderDisconnect(); break;
        case 'help':       renderHelp();       break;
        default:           renderHome();       break;
      }
      screen.render();
    } catch (err) {
      renderErrorView('Navigation Error', err.message || 'An error occurred while loading this view.');
      screen.render();
    }
  };

  // ─── KEYBOARD HANDLERS ───────────────────────────────────────────
  screen.key(['q', 'C-c'], () => process.exit(0));
  screen.key(['?'], () => goto(currentView === 'help' ? 'home' : 'help'));
  screen.key(['h', 'm', '1'], () => goto('home'));
  screen.key(['2'], () => goto('servers'));
  screen.key(['3'], () => goto('connect'));
  screen.key(['4'], () => goto('speedtest'));
  screen.key(['5'], () => goto('dashboard'));
  screen.key(['6'], () => goto('peers'));
  screen.key(['7'], () => goto('check'));
  screen.key(['8'], () => goto('watchdog'));
  screen.key(['9'], () => goto('deploy'));

  screen.key(['escape', 'backspace'], () => {
    if (currentView !== 'home') goto('home');
  });

  screen.key(['n'], () => {
    if (currentView === 'disconnect') goto('home');
  });

  screen.key(['y'], async () => {
    if (currentView !== 'disconnect') return;
    await runCmd(async () => {
      const run = (await import('./stop.js')).default;
      await run({ json: false });
    });
  });

  // Server management keys: delete, set active, add, ping
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
      await runCmd(async () => {
        const readline = (await import('node:readline')).default || (await import('node:readline'));
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const ask = (q) => new Promise(res => rl.question(q, res));

        console.log('\x1b[36m\n  Add New Server Profile\x1b[0m\n');
        const alias = (await ask('  Profile alias (e.g. oracle-fra): ')).trim();
        const server = (await ask('  Server address (user@host): ')).trim();
        const tag = (await ask('  Tags (optional, comma-separated): ')).trim();
        rl.close();

        if (alias && server) {
          const tags = tag ? tag.split(',').map(t => t.trim()).filter(Boolean) : [];
          addProfile(alias, server, tags);
          console.log(`\n  \x1b[32m✓ Saved profile '${alias}' → ${server}\x1b[0m`);
        } else {
          console.log('\n  \x1b[33m⚠ Alias and server address are required.\x1b[0m');
        }
      });
    }
  });

  screen.key(['d'], async () => {
    if (currentView === 'servers') await goto('deploy');
  });

  // Navigation: Up/Down arrow keys & Tab
  screen.key(['up', 'k', 'S-tab'], () => {
    if (currentView === 'servers') {
      const { profiles } = getProfiles();
      const n = Object.keys(profiles).length;
      if (n > 0) { srvIdx = (srvIdx - 1 + n) % n; renderServers(); screen.render(); }
    } else {
      if (menuIdx > 0) {
        menuIdx--;
        renderSidebar();
        screen.render();
      }
    }
  });

  screen.key(['down', 'j', 'tab'], () => {
    if (currentView === 'servers') {
      const { profiles } = getProfiles();
      const n = Object.keys(profiles).length;
      if (n > 0) { srvIdx = (srvIdx + 1) % n; renderServers(); screen.render(); }
    } else {
      if (menuIdx < NAV.length - 1) {
        menuIdx++;
        renderSidebar();
        screen.render();
      }
    }
  });

  // Enter handler
  screen.key(['enter'], async () => {
    if (currentView === 'servers') {
      const { profiles } = getProfiles();
      const names = Object.keys(profiles);
      if (names.length === 0) {
        await goto('deploy');
      } else {
        const entry = profiles[names[srvIdx]];
        const serverStr = typeof entry === 'string' ? entry : (entry?.server || entry);
        await runCmd(async () => {
          const run = (await import('./start.js')).default;
          await run({ server: serverStr, mode: 'auto', json: false });
        });
      }
    } else if (currentView === 'speedtest') {
      await runCmd(async () => {
        const run = (await import('./speedtest.js')).default;
        await run({ json: false });
      });
    } else if (currentView === 'watchdog') {
      await runCmd(async () => {
        const { watchdogCheck } = await import('./watchdog.js');
        await watchdogCheck({ json: false });
      });
    } else if (currentView === 'check') {
      await runCmd(async () => {
        const run = (await import('./check.js')).default;
        await run({ json: false });
      });
    } else if (currentView === 'peers') {
      await runCmd(async () => {
        const { peerList } = await import('./peer.js');
        await peerList({ json: false });
      });
    } else if (currentView === 'deploy') {
      await runCmd(async () => {
        const readline = (await import('node:readline')).default || (await import('node:readline'));
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        const ask = (q) => new Promise(res => rl.question(q, res));

        console.log('\x1b[36m\n  ╔══════════════════════════════════════╗');
        console.log('  ║   Polaris VPN — Deploy Wizard        ║');
        console.log('  ╚══════════════════════════════════════╝\x1b[0m\n');

        const serverRaw = await ask('  \x1b[36mServer address\x1b[0m \x1b[90m(e.g. ubuntu@1.2.3.4)\x1b[0m: ');
        const serverStr = serverRaw.trim();
        if (!serverStr || (!serverStr.includes('@') && !serverStr.includes('.'))) {
          console.log('\n  \x1b[31m✗ Invalid server address.\x1b[0m');
          rl.close();
          return;
        }

        const keyPath = await ask('  \x1b[36mSSH key path\x1b[0m \x1b[90m(leave blank for default ~/.ssh/id_rsa)\x1b[0m: ');

        console.log('\n  \x1b[90mMode options:\x1b[0m');
        console.log('  \x1b[36m[1]\x1b[0m WireGuard     \x1b[90mFast, modern VPN protocol with BBR\x1b[0m');
        console.log('  \x1b[35m[2]\x1b[0m AmneziaWG     \x1b[90mStealth mode — bypasses DPI firewalls\x1b[0m');
        const modeChoice = await ask('\n  Select mode \x1b[90m[1/2, default 1]\x1b[0m: ');
        const mode = modeChoice.trim() === '2' ? 'amneziawg' : 'wireguard';

        const aliasRaw = await ask('  \x1b[36mSave as profile alias\x1b[0m \x1b[90m(leave blank to skip saving)\x1b[0m: ');
        rl.close();

        console.log(`\n  \x1b[36m▶ Deploying ${mode.toUpperCase()} on ${serverStr}...\x1b[0m\n`);

        const { deployServer } = await import('../core/deploy-service.js');
        const res = await deployServer(serverStr, {
          mode,
          privateKey: keyPath.trim() || undefined,
          onProgress: (msg) => console.log(`  \x1b[90m→ ${msg}\x1b[0m`)
        });

        console.log(`\n  \x1b[32m✓ Deployment complete!\x1b[0m`);
        console.log(`  \x1b[90mConfig: ${res.clientConfPath}\x1b[0m`);

        if (aliasRaw.trim()) {
          addProfile(aliasRaw.trim(), serverStr);
          console.log(`  \x1b[32m✓ Saved as profile '${aliasRaw.trim()}'\x1b[0m`);
        }

        console.log(`\n  \x1b[36m▶ Connecting to tunnel...\x1b[0m\n`);
        const startRun = (await import('./start.js')).default;
        await startRun({ server: serverStr, mode, json: false });
      });
    } else {
      const v = VIEWS[NAV[menuIdx]];
      if (v) await goto(v.id);
    }
  });

  // ─── RESIZE ───────────────────────────────────────────────────────
  screen.on('resize', () => {
    try {
      screen.realloc();
      if (!checkScreenDimensions()) return;
      renderSidebar();
      switch (currentView) {
        case 'home':       renderHome();       break;
        case 'servers':    renderServers();    break;
        case 'speedtest':  renderSpeedtest();  break;
        case 'watchdog':   renderWatchdog();   break;
        case 'check':      renderCheck();      break;
        case 'deploy':     renderDeploy();     break;
        case 'peers':      renderPeers();      break;
        case 'disconnect': renderDisconnect(); break;
        case 'help':       renderHelp();       break;
        default:           renderHome();       break;
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
