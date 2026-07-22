import blessed from 'blessed';
import { readFileSync } from 'fs';
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
// null entries render as visual separators
const VIEWS = [
  { id: 'home',       label: 'Home',          icon: '◈' },
  { id: 'servers',    label: 'Servers',        icon: '⚙' },
  { id: 'connect',    label: 'Quick Connect',  icon: '▶' },
  { id: 'dashboard',  label: 'Live Monitor',   icon: '◉' },
  null,
  { id: 'peers',      label: 'Peers',          icon: '≡' },
  { id: 'check',      label: 'Privacy Check',  icon: '✦' },
  { id: 'deploy',     label: 'Deploy VPS',     icon: '⊕' },
  null,
  { id: 'disconnect', label: 'Disconnect',     icon: '■', danger: true },
  { id: 'quit',       label: 'Quit',           icon: '✕', danger: true },
];

// Flat list of navigable indices (no separators)
const NAV = VIEWS.reduce((acc, v, i) => { if (v) acc.push(i); return acc; }, []);

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const pingServer = (ip) => {
  if (!ip) return '—';
  const win = os.platform() === 'win32';
  const r = spawnSync('ping', win ? ['-n','1','-w','500',ip] : ['-c','1','-W','1',ip], { encoding: 'utf-8' });
  if (r.status === 0) {
    const m = r.stdout.match(win ? /Average = (\d+)ms/ : /time=([\d.]+)\s*ms/);
    if (m) return `${m[1]} ms`;
  }
  return 'Timeout';
};

const fmtBytes = (n) => {
  if (!n || n === 0) return '0 B';
  const k = 1024, s = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(n) / Math.log(k));
  return `${(n / Math.pow(k, i)).toFixed(1)} ${s[i]}`;
};

const wgStats = (isAwg = false) => {
  const cmd = isAwg ? 'awg' : 'wg';
  let r = spawnSync('sudo', [cmd, 'show', 'all', 'dump'], { encoding: 'utf-8' });
  if (r.status !== 0 && isAwg) {
    r = spawnSync('sudo', ['wg', 'show', 'all', 'dump'], { encoding: 'utf-8' });
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
};

// ─── MAIN TUI ────────────────────────────────────────────────────────────────
export default async () => {
  const { getActiveTunnel } = await import('../core/tunnel-service.js');
  const { getProfiles }     = await import('../core/profile-service.js');

  // ─── APP STATE ────────────────────────────────────────────────────
  let menuIdx     = 0;   // index into NAV array (sidebar highlight)
  let currentView = 'home';
  let srvIdx      = 0;   // selected server in Servers view

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
  const wHeader = blessed.box({
    parent: screen,
    top: 0, left: 0, width: '100%', height: HEADER_H,
    tags: true, content: LOGO,
    style: { bg: D.bg },
  });

  // Version tag (top-right)
  const wVersion = blessed.box({
    parent: screen,
    top: 1, right: 2, width: 26, height: 5,
    tags: true,
    content: [
      '',
      `${mu('version ')}${t(D.accent, pkg.version)}`,
      mu('Command your privacy.'),
      mu('─────────────────────'),
    ].join('\n'),
    style: { bg: D.bg }, align: 'right',
  });

  // Thin separator line under header
  blessed.box({
    parent: screen,
    top: HEADER_H, left: 0, width: '100%', height: 1,
    style: { bg: D.accentDim },
  });

  // Sidebar outer border
  const wSidebarBorder = blessed.box({
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

  // Sidebar nav (plain box — no blessed.list focus fights)
  const wNav = blessed.box({
    parent: screen,
    top: HEADER_H + 6, left: 1, width: SIDEBAR_W - 2, bottom: FOOTER_H + 4,
    tags: true, content: '',
    style: { bg: D.bgSidebar },
    mouse: true,
  });

  // Sidebar bottom hint
  const wHint = blessed.box({
    parent: screen,
    bottom: FOOTER_H, left: 0, width: SIDEBAR_W, height: 4,
    tags: true, content: '',
    border: { type: 'line' },
    style: { border: { fg: D.sep }, bg: D.bgSidebar, fg: D.muted },
    padding: { left: 1 },
  });

  // Main content panel
  const wMain = blessed.box({
    parent: screen,
    top: HEADER_H + 1, left: SIDEBAR_W, right: 0, bottom: FOOTER_H,
    tags: true,
    scrollable: true, alwaysScroll: true, mouse: true,
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

  // ─── RENDER HELPERS ───────────────────────────────────────────────

  const setFooter = (...pairs) => {
    wFooter.setContent(
      '  ' + pairs.map(([k, v]) => `${t(D.accent, b(`[${k}]`))} ${mu(v)}`).join('   ')
    );
  };

  const defaultFooter = () => setFooter(
    ['↑/↓', 'Navigate'],
    ['Enter', 'Select'],
    ['?', 'Help'],
    ['q', 'Quit'],
  );

  const setView = (id, lines, ...footerPairs) => {
    const v = VIEWS.find(x => x && x.id === id);
    const lbl = v ? `${v.icon}  ${v.label.toUpperCase()}` : id.toUpperCase();
    wMain.setLabel(`{${D.accent}-fg} ${lbl} {/}`);
    wMain.setContent('\n' + (Array.isArray(lines) ? lines.join('\n') : lines));
    wMain.scrollTo(0);
    footerPairs.length ? setFooter(...footerPairs) : defaultFooter();
  };

  // ─── SIDEBAR RENDERER ─────────────────────────────────────────────
  const renderSidebar = () => {
    const info = getActiveTunnel();

    // Status pill
    if (info) {
      const upMin = Math.floor((Date.now() - new Date(info.startTime).getTime()) / 60000);
      wStatus.setContent(
        `  ${t(D.success, '⬤')} ${b(t(D.bright, 'CONNECTED'))}\n` +
        `  ${mu(info.server.substring(0, SIDEBAR_W - 5))}\n` +
        `  ${badge(info.mode)}  ${mu(upMin + 'm')}`
      );
    } else {
      wStatus.setContent(
        `  ${t(D.danger, '⬤')} ${b(t(D.muted, 'DISCONNECTED'))}\n` +
        `  ${mu('No active tunnel')}`
      );
    }

    // Nav items
    const selectedViewsIdx = NAV[menuIdx];
    const lines = [];
    for (let i = 0; i < VIEWS.length; i++) {
      const v = VIEWS[i];
      if (!v) {
        lines.push(mu(' ─────────────────────'));
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

    // Bottom hint
    const sv = VIEWS[selectedViewsIdx];
    wHint.setContent(sv ? `\n ${t(D.accent, sv.icon)}  ${mu(sv.label)}` : '');
  };

  // ─── CONTENT VIEWS ────────────────────────────────────────────────

  const renderHome = () => {
    const info = getActiveTunnel();
    const L = [];
    if (info) {
      const upMin = Math.floor((Date.now() - new Date(info.startTime).getTime()) / 60000);
      const ping  = pingServer(info.server.split('@').pop());
      const wg    = wgStats(info.mode === 'amneziawg');
      L.push(`${t(D.accent, b('◈  Tunnel Status'))}    ${t(D.success, '⬤  ACTIVE')}`);
      L.push(hr()); L.push('');
      L.push(`  ${mu('Server  ')}  ${b(info.server)}`);
      L.push(`  ${mu('Mode    ')}  ${badge(info.mode)}`);
      L.push(`  ${mu('Uptime  ')}  ${t(D.bright, upMin + ' min')}`);
      L.push(`  ${mu('Latency ')}  ${t(D.accent, ping)}`);
      if (wg) {
        L.push(`  ${mu('Data ↓  ')}  ${t(D.success, fmtBytes(wg.rx))}`);
        L.push(`  ${mu('Data ↑  ')}  ${t(D.warning, fmtBytes(wg.tx))}`);
      }
      L.push(''); L.push(hr()); L.push('');
      L.push(`  ${mu('Go to ')}${t(D.accent, 'Live Monitor')} ${mu('for real-time bandwidth graphs.')}`);
      L.push(`  ${mu('Go to ')}${t(D.danger,  'Disconnect')}  ${mu('to tear down the tunnel.')}`);
    } else {
      const { profiles, active } = getProfiles();
      const names = Object.keys(profiles);
      L.push(`${t(D.accent, b('◈  Welcome to Polaris VPN'))}`);
      L.push(hr()); L.push('');
      L.push(`  ${t(D.danger, '⬤')}  ${b(t(D.muted, 'No active tunnel.'))}`); L.push('');
      if (names.length > 0) {
        L.push(`  ${t(D.accent, b('Saved Profiles'))}`); L.push('');
        names.forEach((n, i) => {
          const act = n === active;
          L.push(
            `  ${mu((i + 1) + '.')}  ${t(act ? D.success : D.text, n)}` +
            `   ${mu(profiles[n])}` +
            (act ? `  ${t(D.success, '← active')}` : '')
          );
        });
        L.push(''); L.push(hr()); L.push('');
        L.push(`  ${mu('Use ')}${t(D.accent, 'Servers')}${mu(' to connect.')}`);
      } else {
        L.push(`  ${t(D.warning, '⚠')}  ${mu('No profiles saved yet.')}`); L.push('');
        L.push(`  ${mu('Run: ')}${t(D.accent, 'polaris add <alias> --server <user@host>')}`);
      }
    }
    setView('home', L);
  };

  const renderServers = () => {
    const { profiles, active } = getProfiles();
    const names = Object.keys(profiles);
    const L = [];
    L.push(`${t(D.accent, b('⚙  Server Profiles'))}`); L.push(hr()); L.push('');
    if (names.length === 0) {
      L.push(`  ${t(D.warning, '⚠')}  No saved profiles.`); L.push('');
      L.push(`  ${mu('Run: ')}${t(D.accent, 'polaris add <alias> --server <user@host>')}`);
    } else {
      L.push(`  ${t(D.accent, '[↑/↓]')}${mu(' Browse   ')}${t(D.accent, '[Enter]')}${mu(' Connect')}`); L.push('');
      names.forEach((n, i) => {
        const sel = i === srvIdx, act = n === active;
        const cur  = sel ? t(D.accent, '▶') : ' ';
        const name = sel ? b(t(D.bright, n)) : t(act ? D.success : D.text, n);
        const pill = act ? `  ${t(D.success, '⬤')}` : '';
        L.push(`  ${cur}  ${name}${pill}`);
        L.push(`      ${mu(profiles[n])}`);
        L.push('');
      });
      L.push(hr());
      L.push(`  ${mu('Selected: ')}${t(D.accent, names[srvIdx] || '—')}`);
    }
    setView('servers', L, ['↑/↓', 'Browse'], ['Enter', 'Connect'], ['Esc', 'Back']);
  };

  const renderCheck = () => {
    const L = [];
    L.push(`${t(D.accent, b('✦  Privacy Check'))}`); L.push(hr()); L.push('');
    L.push(`  ${b('Three-point leak test:')}`); L.push('');
    [[D.success,'①','Public IP Check','Verify your IP has changed'],
     [D.success,'②','DNS Leak Test',  'Verify DNS uses VPN resolver'],
     [D.success,'③','IPv6 Leak Test', 'Verify no IPv6 exposure']].forEach(([c,n,ti,de]) => {
      L.push(`  ${t(c, n)}  ${b(ti)}   ${mu(de)}`);
    });
    L.push(''); L.push(hr()); L.push('');
    L.push(`  Press ${t(D.accent, '[Enter]')} to run all checks.`);
    L.push(`  ${mu('Briefly suspends the TUI.')}`);
    setView('check', L, ['Enter', 'Run checks'], ['Esc', 'Back']);
  };

  const renderDeploy = () => {
    const L = [];
    L.push(`${t(D.accent, b('⊕  Deploy a VPS Server'))}`); L.push(hr()); L.push('');
    L.push(`  Polaris automatically provisions a remote VPS`);
    L.push(`  with WireGuard or AmneziaWG in under 60 seconds.`);
    L.push(''); L.push(hr()); L.push('');
    L.push(`  ${t(D.accent, b('Modes'))}`); L.push('');
    L.push(`  ${t(D.success, '▶')}  ${b('WireGuard')}    ${mu('Fast, modern VPN protocol')}`);
    L.push(`  ${t(D.purple,  '▶')}  ${b('AmneziaWG')}   ${mu('Stealth mode — DPI bypass')}`);
    L.push(''); L.push(hr()); L.push('');
    L.push(`  Press ${t(D.accent, '[Enter]')} to start the deployment wizard.`);
    L.push(`  ${mu('Or run: ')}${t(D.accent, 'polaris deploy --server ubuntu@<ip>')}`);
    setView('deploy', L, ['Enter', 'Deploy wizard'], ['Esc', 'Back']);
  };

  const renderPeers = () => {
    const L = [];
    L.push(`${t(D.accent, b('≡  WireGuard Peers'))}`); L.push(hr()); L.push('');
    const info = getActiveTunnel();
    const isAwg = info && info.mode === 'amneziawg';
    const cmd = isAwg ? 'awg' : 'wg';
    let r = spawnSync('sudo', [cmd, 'show', 'all', 'dump'], { encoding: 'utf-8' });
    if (r.status !== 0 && isAwg) {
      r = spawnSync('sudo', ['wg', 'show', 'all', 'dump'], { encoding: 'utf-8' });
    }
    if (r.status !== 0 || !r.stdout.trim()) {
      L.push(`  ${t(D.warning, '⚠')}  No WireGuard interface found.`);
      L.push(`  ${mu('Start a WireGuard tunnel first.')}`);
    } else {
      const rows = r.stdout.trim().split('\n').slice(1);
      if (rows.length === 0) {
        L.push(`  ${mu('No peers configured.')}`);
      } else {
        L.push(`  ${mu('Peer Key        Endpoint              RX          TX')}`);
        L.push(`  ${hr(52)}`);
        rows.forEach(row => {
          const p   = row.split('\t');
          const key = ((p[1] || '').substring(0, 10) + '…').padEnd(14);
          const ep  = (p[4] || 'N/A').substring(0, 18).padEnd(20);
          const rx  = fmtBytes(parseInt(p[6], 10) || 0).padStart(8);
          const tx  = fmtBytes(parseInt(p[7], 10) || 0).padStart(8);
          L.push(`  ${t(D.accent, key)}  ${mu(ep)}  ${t(D.success, rx)}  ${t(D.warning, tx)}`);
        });
        L.push(''); L.push(mu(`  ${rows.length} peer(s) found.`));
      }
    }
    setView('peers', L, ['r', 'Refresh'], ['Esc', 'Back']);
  };

  const renderDisconnect = () => {
    const info = getActiveTunnel();
    const L = [];
    L.push(`${t(D.danger, b('■  Disconnect Tunnel'))}`); L.push(hr()); L.push('');
    if (!info) {
      L.push(`  ${t(D.muted, '⬤')}  ${mu('No active tunnel to disconnect.')}`);
      L.push(''); L.push(`  Press ${t(D.accent, '[Esc]')} to go back.`);
      setView('disconnect', L, ['Esc', 'Back']);
    } else {
      L.push(`  ${t(D.danger, '⚠')}  ${b('You are about to disconnect:')}`); L.push('');
      L.push(`  ${mu('Server  ')}  ${b(info.server)}`);
      L.push(`  ${mu('Mode    ')}  ${badge(info.mode)}`);
      L.push(''); L.push(hr()); L.push('');
      L.push(`  ${t(D.danger, b('[y]'))} to confirm   ${t(D.accent, '[n]')} or ${t(D.accent, '[Esc]')} to cancel.`);
      setView('disconnect', L, ['y', 'Confirm'], ['n / Esc', 'Cancel']);
    }
  };

  const renderHelp = () => {
    const L = [];
    L.push(`${t(D.accent, b('?  Keyboard Shortcuts'))}`); L.push(hr()); L.push('');
    L.push(`  ${t(D.accent, b('Navigation'))}`); L.push('');
    [
      ['↑ / k',       'Move up in sidebar menu'],
      ['↓ / j',       'Move down in sidebar menu'],
      ['Enter',       'Select highlighted item / confirm'],
      ['Esc',         'Go back to Home / cancel'],
      ['h',           'Go to Home'],
      ['?',           'Toggle this help screen'],
      ['q / Ctrl+C',  'Quit Polaris'],
    ].forEach(([k, v]) => L.push(`  ${t(D.accent, k.padEnd(16))} ${mu(v)}`));
    L.push('');
    L.push(`  ${t(D.accent, b('Quick Jump'))}`); L.push('');
    [['1','Home'],['2','Servers'],['3','Quick Connect'],
     ['4','Live Monitor'],['5','Peers'],['6','Privacy Check'],['7','Deploy VPS']]
      .forEach(([k, v]) => L.push(`  ${t(D.accent, k.padEnd(16))} ${mu(v)}`));
    setView('help', L, ['?', 'Close'], ['Esc / h', 'Main Menu']);
  };

  // ─── ERROR VIEW RENDERER ──────────────────────────────────────────
  const renderErrorView = (title, message) => {
    const L = [];
    L.push(`${t(D.danger, b(`⚠  ${title}`))}`);
    L.push(hr());
    L.push('');
    L.push(`  ${t(D.danger, '✖')}  ${b(message)}`);
    L.push('');
    L.push(hr());
    L.push('');
    L.push(`  ${mu('Press ')}${t(D.accent, '[Esc]')}${mu(', ')}${t(D.accent, '[h]')}${mu(' or ')}${t(D.accent, '[1]')}${mu(' to return to the Main Menu.')}`);
    setView('error', L, ['Esc / h / 1', 'Main Menu']);
  };

  // ─── SUSPEND + RUN COMMAND ────────────────────────────────────────
  const runCmd = async (fn) => {
    try {
      screen.destroy();
    } catch (e) {}
    process.stdout.write('\x1b[2J\x1b[H');
    console.log(`\x1b[36m\n  Polaris VPN \x1b[0m\x1b[90m— running command...\x1b[0m\n`);
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

      // Sync sidebar highlight
      const vi = VIEWS.findIndex(v => v && v.id === viewId);
      const ni = NAV.indexOf(vi);
      if (ni !== -1) menuIdx = ni;

      renderSidebar();
      screen.render();

      // Delegated actions
      if (viewId === 'connect') {
        await runCmd(async () => {
          const run = (await import('./start.js')).default;
          await run({ mode: 'auto', json: false });
        });
        return;
      }
      if (viewId === 'dashboard') {
        const { getActiveTunnel } = await import('../core/tunnel-service.js');
        const info = getActiveTunnel();
        if (!info) {
          renderErrorView('Live Monitor Unavailable', 'No active tunnel found. Please connect to a VPN server first before launching the Live Monitor.');
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

      // Render static content views
      switch (viewId) {
        case 'home':       renderHome();       break;
        case 'servers':    srvIdx = 0; renderServers(); break;
        case 'check':      renderCheck();      break;
        case 'deploy':     renderDeploy();     break;
        case 'peers':      renderPeers();      break;
        case 'disconnect': renderDisconnect(); break;
        case 'help':       renderHelp();       break;
        default:           renderHome();       break;
      }
      screen.render();
    } catch (err) {
      renderErrorView('Navigation Error', err.message || 'An error occurred while rendering this view.');
      screen.render();
    }
  };

  // ─── KEYBOARD: ALL HANDLED HERE, NO BLESSED.LIST FOCUS FIGHTS ────
  screen.key(['q', 'C-c'], () => process.exit(0));
  screen.key(['?'], () => goto(currentView === 'help' ? 'home' : 'help'));
  screen.key(['h', 'm', '1'], () => goto('home'));
  screen.key(['2'], () => goto('servers'));
  screen.key(['3'], () => goto('connect'));
  screen.key(['4'], () => goto('dashboard'));
  screen.key(['5'], () => goto('peers'));
  screen.key(['6'], () => goto('check'));
  screen.key(['7'], () => goto('deploy'));

  screen.key(['b'], async () => {
    await runCmd(async () => {
      const run = (await import('./benchmark.js')).default;
      await run({ json: false });
    });
  });

  screen.key(['escape', 'backspace'], () => {
    if (currentView !== 'home') goto('home');
  });

  screen.key(['n'], () => {
    if (currentView === 'disconnect') goto('home');
  });

  screen.key(['r'], () => {
    if (currentView === 'peers') { renderPeers(); screen.render(); }
  });

  // ── Arrow keys — context-aware ───────────────────────────────────
  screen.key(['up', 'k'], () => {
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

  screen.key(['down', 'j'], () => {
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

  // ── Enter ────────────────────────────────────────────────────────
  screen.key(['enter'], async () => {
    if (currentView === 'servers') {
      const { profiles } = getProfiles();
      const names = Object.keys(profiles);
      if (names.length > 0) {
        await runCmd(async () => {
          const run = (await import('./start.js')).default;
          await run({ server: profiles[names[srvIdx]], mode: 'auto', json: false });
        });
      }
    } else if (currentView === 'check') {
      await runCmd(async () => {
        const run = (await import('./check.js')).default;
        await run({ json: false });
      });
    } else if (currentView === 'deploy') {
      await runCmd(async () => {
        console.log('\n  \x1b[36mTo deploy, run:\x1b[0m');
        console.log('  \x1b[90mpolaris deploy --server ubuntu@<your-ip>\x1b[0m\n');
      });
    } else if (currentView === 'peers') {
      renderPeers(); screen.render();
    } else {
      // Enter navigates to the currently highlighted sidebar item
      const v = VIEWS[NAV[menuIdx]];
      if (v) await goto(v.id);
    }
  });

  // ── Disconnect confirm ───────────────────────────────────────────
  screen.key(['y'], async () => {
    if (currentView !== 'disconnect') return;
    await runCmd(async () => {
      const run = (await import('./stop.js')).default;
      await run({ json: false });
    });
  });

  // ── Mouse click on sidebar nav ───────────────────────────────────
  wNav.on('click', async (data) => {
    const row = data.y; // row index within wNav content
    if (row >= 0 && row < VIEWS.length) {
      const v = VIEWS[row];
      if (v) {
        const ni = NAV.indexOf(VIEWS.indexOf(v));
        if (ni !== -1) menuIdx = ni;
        await goto(v.id);
      }
    }
  });

  // ─── RESIZE ───────────────────────────────────────────────────────
  screen.on('resize', () => {
    try {
      screen.realloc();
      renderSidebar();
      switch (currentView) {
        case 'home':       renderHome();       break;
        case 'servers':    renderServers();    break;
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

  // ─── AUTO-REFRESH STATUS ──────────────────────────────────────────
  setInterval(() => {
    try {
      renderSidebar();
      if (currentView === 'home')  renderHome();
      if (currentView === 'peers') renderPeers();
      screen.render();
    } catch (e) {}
  }, 5000);

  // ─── INIT ─────────────────────────────────────────────────────────
  defaultFooter();
  renderSidebar();
  renderHome();
  wMain.focus();
  screen.render();
};
