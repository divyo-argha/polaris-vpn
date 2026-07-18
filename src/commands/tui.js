import blessed from 'blessed';
import contrib from 'blessed-contrib';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import { spawnSync } from 'child_process';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pkg = JSON.parse(readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf-8'));

// ─────────────────────────────────────────────────────────────────────
//  DESIGN SYSTEM
// ─────────────────────────────────────────────────────────────────────
const D = {
  accent:      '#00d7ff',
  accentDim:   '#005f87',
  accentFaint: '#003f5f',
  success:     '#00ff87',
  danger:      '#ff5f5f',
  warning:     '#ffaf00',
  purple:      '#af87ff',
  dim:         '#4e4e4e',
  muted:       '#767676',
  text:        '#d0d0d0',
  textBright:  '#ffffff',
};

const tag = (color, text) => `{${color}-fg}${text}{/}`;
const bold = (text) => `{bold}${text}{/bold}`;
const dim  = (text) => tag(D.muted, text);

// ─────────────────────────────────────────────────────────────────────
//  ASCII LOGO
// ─────────────────────────────────────────────────────────────────────
const LOGO_LINES = [
  `{#00d7ff-fg}{bold}  ██████╗  ██████╗ ██╗      █████╗ ██████╗ ██╗███████╗{/bold}{/}`,
  `{#00d7ff-fg}{bold}  ██╔══██╗██╔═══██╗██║     ██╔══██╗██╔══██╗██║██╔════╝{/bold}{/}`,
  `{#00afff-fg}{bold}  ██████╔╝██║   ██║██║     ███████║██████╔╝██║███████╗{/bold}{/}`,
  `{#0087d7-fg}{bold}  ██╔═══╝ ██║   ██║██║     ██╔══██║██╔══██╗██║╚════██║{/bold}{/}`,
  `{#005faf-fg}{bold}  ██║     ╚██████╔╝███████╗██║  ██║██║  ██║██║███████║{/bold}{/}`,
  `{#005faf-fg}{bold}  ╚═╝      ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚══════╝{/bold}{/}`,
];

// ─────────────────────────────────────────────────────────────────────
//  NAVIGATION MENU STRUCTURE
// ─────────────────────────────────────────────────────────────────────
const VIEWS = [
  { id: 'home',      label: 'Home',          icon: '◈', group: 'main'  },
  { id: 'servers',   label: 'Servers',       icon: '⚙', group: 'main'  },
  { id: 'connect',   label: 'Quick Connect', icon: '▶', group: 'main'  },
  { id: 'dashboard', label: 'Live Monitor',  icon: '◉', group: 'main'  },
  null,
  { id: 'peers',     label: 'Peers',         icon: '≡', group: 'tools' },
  { id: 'check',     label: 'Privacy Check', icon: '✦', group: 'tools' },
  { id: 'deploy',    label: 'Deploy VPS',    icon: '⊕', group: 'tools' },
  null,
  { id: 'disconnect',label: 'Disconnect',    icon: '■', group: 'ctrl', danger: true },
  { id: 'quit',      label: 'Quit',          icon: '✕', group: 'ctrl', danger: true },
];

// ─────────────────────────────────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────────────────────────────────
const pingServer = (ip) => {
  if (!ip) return '—';
  const isWin = os.platform() === 'win32';
  const res = spawnSync('ping', isWin ? ['-n','1','-w','1000',ip] : ['-c','1','-W','1',ip], { encoding:'utf-8' });
  if (res.status === 0) {
    const m = res.stdout.match(isWin ? /Average = (\d+)ms/ : /time=([\d.]+)\s*ms/);
    if (m) return `${m[1]} ms`;
  }
  return 'Timeout';
};

const formatBytes = (b) => {
  if (!b || b === 0) return '0 B';
  const k = 1024, s = ['B','KB','MB','GB','TB'];
  const i = Math.floor(Math.log(b) / Math.log(k));
  return `${parseFloat((b / Math.pow(k, i)).toFixed(1))} ${s[i]}`;
};

const getWgStats = () => {
  const r = spawnSync('sudo', ['wg', 'show', 'all', 'dump'], { encoding: 'utf-8' });
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

const modeColor = (mode) => {
  if (!mode) return D.muted;
  switch (mode.toLowerCase()) {
    case 'wireguard':  return D.success;
    case 'amneziawg': return D.purple;
    case 'tls':        return D.warning;
    default:           return D.accent;
  }
};

const modeBadge = (mode) => {
  if (!mode) return dim('unknown');
  return tag(modeColor(mode), mode.toUpperCase());
};

const hr = (w = 44) => dim('─'.repeat(w));

// ─────────────────────────────────────────────────────────────────────
//  MAIN TUI
// ─────────────────────────────────────────────────────────────────────
export default async () => {
  const { getActiveTunnel } = await import('../core/tunnel-service.js');
  const { getProfiles }     = await import('../core/profile-service.js');

  const screen = blessed.screen({
    smartCSR:    true,
    title:       `Polaris VPN  v${pkg.version}`,
    fullUnicode: true,
    dockBorders: true,
    forceUnicode: true,
  });

  // ── TOP HEADER ────────────────────────────────────────────────────
  const headerBox = blessed.box({
    parent: screen,
    top: 0, left: 0,
    width: '100%', height: 8,
    tags: true,
    content: LOGO_LINES.join('\n'),
    style: { bg: 'black' },
  });

  // Version + subtitle in header (right-aligned)
  const headerMeta = blessed.box({
    parent: screen,
    top: 0, right: 1,
    width: 42, height: 8,
    tags: true,
    content: [
      '',
      '',
      `${dim('version')} ${tag(D.accent, pkg.version)}`,
      `${dim('Leave no trace.')}`,
      `${dim('─────────────────────────────────')}`,
      '',
      '',
      '',
    ].join('\n'),
    style: { bg: 'black' },
    align: 'right',
  });

  // Separator line under header
  blessed.line({
    parent: screen,
    top: 8, left: 0,
    orientation: 'horizontal',
    width: '100%',
    style: { fg: D.accentDim },
  });

  // ── LEFT SIDEBAR ──────────────────────────────────────────────────
  const SIDEBAR_W = 24;

  const sidebarBorder = blessed.box({
    parent: screen,
    top: 9, left: 0,
    width: SIDEBAR_W, bottom: 3,
    tags: true,
    border: { type: 'line' },
    style: { border: { fg: D.accentDim }, bg: 'black' },
  });

  // Status pill inside sidebar
  const sidebarStatus = blessed.box({
    parent: screen,
    top: 10, left: 2,
    width: SIDEBAR_W - 4, height: 3,
    tags: true,
    content: '',
    style: { bg: 'black' },
  });

  // Thin separator inside sidebar
  blessed.line({
    parent: screen,
    top: 13, left: 1,
    orientation: 'horizontal',
    width: SIDEBAR_W - 2,
    style: { fg: D.dim },
  });

  // The navigable list (below status pill)
  const navList = blessed.list({
    parent: screen,
    top: 14, left: 1,
    width: SIDEBAR_W - 2, bottom: 4,
    tags: true,
    keys: true,
    vi: true,
    mouse: true,
    scrollable: false,
    items: [],
    style: {
      bg: 'black',
      fg: D.text,
      selected: { bg: D.accentDim, fg: D.textBright, bold: true },
      item: { fg: D.text },
    },
  });

  // Sidebar footer hint
  const sidebarHint = blessed.box({
    parent: screen,
    bottom: 3, left: 1,
    width: SIDEBAR_W - 2, height: 3,
    tags: true,
    content: '',
    style: { bg: 'black', fg: D.muted },
    border: { type: 'line' },
    style: { border: { fg: D.dim }, bg: 'black', fg: D.muted },
  });

  // ── RIGHT MAIN PANEL ─────────────────────────────────────────────
  const mainPanel = blessed.box({
    parent: screen,
    top: 9, left: SIDEBAR_W,
    right: 0, bottom: 3,
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    mouse: true,
    style: {
      bg: 'black',
      fg: D.text,
      border: { fg: D.accentDim, bg: 'black' },
    },
    border: { type: 'line' },
    padding: { left: 3, right: 3, top: 1, bottom: 1 },
  });

  // ── BOTTOM FOOTER ─────────────────────────────────────────────────
  const footer = blessed.box({
    parent: screen,
    bottom: 0, left: 0,
    width: '100%', height: 3,
    tags: true,
    content: '',
    style: {
      bg: 'black',
      border: { fg: D.dim },
    },
    border: { type: 'line' },
    padding: { left: 1 },
  });

  // ─────────────────────────────────────────────────────────────────
  //  BUILD SIDEBAR ITEMS LIST
  // ─────────────────────────────────────────────────────────────────
  // Map from navList visual index → VIEWS index
  const navMap = [];

  const buildNavItems = () => {
    navMap.length = 0;
    const items = [];
    for (let i = 0; i < VIEWS.length; i++) {
      const v = VIEWS[i];
      if (!v) {
        items.push(dim('  ──────────────────'));
        navMap.push(null); // separator
      } else {
        const color = v.danger ? D.danger : D.muted;
        items.push(`${tag(color, v.icon)}  ${v.label}`);
        navMap.push(i);
      }
    }
    navList.setItems(items);
  };

  buildNavItems();

  // ─────────────────────────────────────────────────────────────────
  //  STATUS PILL (sidebar + header)
  // ─────────────────────────────────────────────────────────────────
  const updateSidebarStatus = () => {
    const info = getActiveTunnel();
    if (info) {
      sidebarStatus.setContent(
        `  ${tag(D.success, '⬤')} ${bold(tag(D.textBright, 'CONNECTED'))}\n` +
        `  ${dim(info.server.substring(0, 18))}\n` +
        `  ${modeBadge(info.mode)}`
      );
    } else {
      sidebarStatus.setContent(
        `  ${tag(D.danger, '⬤')} ${bold(tag(D.muted, 'DISCONNECTED'))}\n` +
        `  ${dim('No active tunnel')}`
      );
    }
  };

  // ─────────────────────────────────────────────────────────────────
  //  FOOTER UPDATER
  // ─────────────────────────────────────────────────────────────────
  const setFooter = (keys) => {
    const parts = keys.map(([k, v]) =>
      `${tag(D.accent, bold(`[${k}]`))} ${dim(v)}`
    );
    footer.setContent('  ' + parts.join('   '));
  };

  const defaultFooter = () => setFooter([
    ['↑/↓', 'Navigate'],
    ['Enter', 'Select'],
    ['Tab', 'Switch Focus'],
    ['?', 'Help'],
    ['q', 'Quit'],
  ]);

  // ─────────────────────────────────────────────────────────────────
  //  VIEW RENDERERS
  // ─────────────────────────────────────────────────────────────────

  const setView = (id, content, footerKeys) => {
    const viewMeta = VIEWS.find(v => v && v.id === id);
    const label = viewMeta ? `${viewMeta.icon}  ${viewMeta.label.toUpperCase()}` : id.toUpperCase();
    mainPanel.setLabel(`{${D.accent}-fg} ${label} {/}`);
    mainPanel.setContent(content);
    mainPanel.scrollTo(0);
    if (footerKeys) setFooter(footerKeys); else defaultFooter();
    screen.render();
  };

  // ── HOME ─────────────────────────────────────────────────────────
  const renderHome = () => {
    const info   = getActiveTunnel();
    const lines  = [];

    if (info) {
      const uptimeMin = Math.floor((Date.now() - new Date(info.startTime).getTime()) / 60000);
      const serverIp  = info.server.split('@').pop();
      const ping      = pingServer(serverIp);
      const wgStats   = getWgStats();

      lines.push(`${tag(D.accent, bold('◈  Tunnel Status'))}    ${tag(D.success, '⬤  ACTIVE')}`);
      lines.push(hr(48));
      lines.push('');
      lines.push(`  ${dim('Server  ')}  ${bold(info.server)}`);
      lines.push(`  ${dim('Mode    ')}  ${modeBadge(info.mode)}`);
      lines.push(`  ${dim('Uptime  ')}  ${tag(D.textBright, uptimeMin + ' min')}`);
      lines.push(`  ${dim('Latency ')}  ${tag(D.accent, ping)}`);
      if (wgStats) {
        lines.push(`  ${dim('Data ↓  ')}  ${tag(D.success, formatBytes(wgStats.rx))}`);
        lines.push(`  ${dim('Data ↑  ')}  ${tag(D.warning, formatBytes(wgStats.tx))}`);
      }
      lines.push('');
      lines.push(hr(48));
      lines.push('');
      lines.push(`  ${dim('Select')} ${tag(D.accent, 'Live Monitor')} ${dim('for real-time bandwidth graphs.')}`);
      lines.push(`  ${dim('Select')} ${tag(D.accent, 'Disconnect')} ${dim('to tear down the tunnel.')}`);
    } else {
      lines.push(`${tag(D.accent, bold('◈  Welcome to Polaris VPN'))}`);
      lines.push(hr(48));
      lines.push('');
      lines.push(`  ${tag(D.danger, '⬤')}  ${bold(tag(D.muted, 'No active tunnel found.'))}`);
      lines.push('');
      lines.push(`  ${dim('Get started by connecting to a server.')}`);
      lines.push('');
      lines.push(hr(48));
      lines.push('');

      const { profiles, active } = getProfiles();
      const names = Object.keys(profiles);
      if (names.length > 0) {
        lines.push(`  ${tag(D.accent, bold('Saved Profiles'))}`);
        lines.push('');
        names.forEach((n, i) => {
          const isActive = n === active;
          lines.push(
            `  ${dim((i + 1) + '.')}  ${tag(isActive ? D.success : D.text, n)}` +
            `   ${dim(profiles[n])}` +
            (isActive ? `  ${tag(D.success, '← active')}` : '')
          );
        });
        lines.push('');
        lines.push(`  ${dim('Select')} ${tag(D.accent, 'Quick Connect')} ${dim('to use the active profile.')}`);
      } else {
        lines.push(`  ${tag(D.warning, '⚠')}  ${dim('No profiles saved.')}`);
        lines.push('');
        lines.push(`  ${dim('Run')} ${tag(D.accent, 'polaris add <alias> --server <user@host>')} ${dim('to add one.')}`);
        lines.push(`  ${dim('Or select')} ${tag(D.accent, 'Deploy VPS')} ${dim('to provision one automatically.')}`);
      }
    }

    setView('home', '\n' + lines.join('\n'));
  };

  // ── SERVERS ───────────────────────────────────────────────────────
  let serverSelectIndex = 0;
  const renderServers = () => {
    const { profiles, active } = getProfiles();
    const names = Object.keys(profiles);
    const lines = [];

    lines.push(`${tag(D.accent, bold('⚙  Server Profiles'))}`);
    lines.push(hr(48));
    lines.push('');

    if (names.length === 0) {
      lines.push(`  ${tag(D.warning, '⚠')}  No saved profiles found.`);
      lines.push('');
      lines.push(`  ${dim('Add a server:')}`);
      lines.push(`  ${tag(D.accent, 'polaris add <alias> --server <user@host>')}`);
    } else {
      lines.push(`  ${dim('Use')} ${tag(D.accent, '[↑/↓]')} ${dim('to browse,')} ${tag(D.accent, '[Enter]')} ${dim('to connect.')}`);
      lines.push('');

      names.forEach((n, i) => {
        const isSelected = i === serverSelectIndex;
        const isActive   = n === active;
        const cursor     = isSelected ? tag(D.accent, '▶') : ' ';
        const nameTag    = isSelected
          ? `{${D.accent}-fg}{bold}${n}{/bold}{/}`
          : isActive ? tag(D.success, n) : n;
        const pill       = isActive ? `  ${tag(D.success, '⬤ active')}` : '';

        lines.push(`  ${cursor}  ${nameTag}${pill}`);
        lines.push(`      ${dim(profiles[n])}`);
        lines.push('');
      });

      lines.push(hr(48));
      lines.push('');
      lines.push(`  ${dim('Selected:')} ${tag(D.accent, names[serverSelectIndex] || '—')}`);
    }

    setView('servers', '\n' + lines.join('\n'), [
      ['↑/↓',  'Browse'],
      ['Enter', 'Connect to selected'],
      ['d',     'Delete profile'],
      ['Esc',   'Back'],
    ]);
  };

  // ── PRIVACY CHECK ─────────────────────────────────────────────────
  const renderCheck = () => {
    const lines = [];
    lines.push(`${tag(D.accent, bold('✦  Privacy Check'))}`);
    lines.push(hr(48));
    lines.push('');
    lines.push(`  This will run three leak tests:`);
    lines.push('');
    lines.push(`  ${tag(D.success, '①')}  ${bold('Public IP Check')}   ${dim('— verify your IP has changed')}`);
    lines.push(`  ${tag(D.success, '②')}  ${bold('DNS Leak Test')}     ${dim('— verify DNS uses VPN resolver')}`);
    lines.push(`  ${tag(D.success, '③')}  ${bold('IPv6 Leak Test')}    ${dim('— verify no IPv6 exposure')}`);
    lines.push('');
    lines.push(hr(48));
    lines.push('');
    lines.push(`  Press ${tag(D.accent, '[Enter]')} to run all three checks.`);
    lines.push(`  ${dim('This will suspend the TUI briefly.')}`);
    setView('check', '\n' + lines.join('\n'), [['Enter', 'Run checks'], ['Esc', 'Back']]);
  };

  // ── DEPLOY ────────────────────────────────────────────────────────
  const renderDeploy = () => {
    const lines = [];
    lines.push(`${tag(D.accent, bold('⊕  Deploy a VPS Server'))}`);
    lines.push(hr(48));
    lines.push('');
    lines.push(`  Polaris can automatically provision a remote VPS`);
    lines.push(`  with WireGuard or AmneziaWG in under 60 seconds.`);
    lines.push('');
    lines.push(hr(48));
    lines.push('');
    lines.push(`  ${tag(D.accent, bold('Supported Modes'))}`);
    lines.push('');
    lines.push(`  ${tag(D.success, '▶')}  ${bold('WireGuard')}    ${dim('— Fast, modern VPN protocol')}`);
    lines.push(`  ${tag(D.purple, '▶')}  ${bold('AmneziaWG')}   ${dim('— Stealth mode (DPI bypass)')}`);
    lines.push('');
    lines.push(hr(48));
    lines.push('');
    lines.push(`  Press ${tag(D.accent, '[Enter]')} to start the deployment wizard.`);
    lines.push('');
    lines.push(`  ${dim('Or run directly:')}`);
    lines.push(`  ${tag(D.accent, 'polaris deploy --server ubuntu@<ip>')}`);
    setView('deploy', '\n' + lines.join('\n'), [['Enter', 'Deploy wizard'], ['Esc', 'Back']]);
  };

  // ── PEERS ─────────────────────────────────────────────────────────
  const renderPeers = () => {
    const lines = [];
    lines.push(`${tag(D.accent, bold('≡  WireGuard Peers'))}`);
    lines.push(hr(48));
    lines.push('');

    const dumpRes = spawnSync('sudo', ['wg', 'show', 'all', 'dump'], { encoding: 'utf-8' });
    if (dumpRes.status !== 0 || !dumpRes.stdout.trim()) {
      lines.push(`  ${tag(D.warning, '⚠')}  No WireGuard interface found.`);
      lines.push(`  ${dim('Start a WireGuard tunnel first.')}`);
    } else {
      const rows = dumpRes.stdout.trim().split('\n').slice(1);
      if (rows.length === 0) {
        lines.push(`  ${dim('No peers configured.')}`);
      } else {
        lines.push(`  ${dim('Peer Key         Endpoint              RX          TX')}`);
        lines.push(`  ${hr(52)}`);
        rows.forEach(r => {
          const p = r.split('\t');
          const key = (p[1] || '').substring(0, 10) + '…';
          const ep  = (p[4] || 'N/A').substring(0, 20);
          const rx  = formatBytes(parseInt(p[6], 10) || 0);
          const tx  = formatBytes(parseInt(p[7], 10) || 0);
          lines.push(
            `  ${tag(D.accent, key)}  ${dim(ep.padEnd(20))}  ` +
            `${tag(D.success, rx.padStart(8))}  ${tag(D.warning, tx.padStart(8))}`
          );
        });
        lines.push('');
        lines.push(`  ${dim(rows.length + ' peer(s) found.')}`);
      }
    }
    setView('peers', '\n' + lines.join('\n'), [['r', 'Refresh'], ['Esc', 'Back']]);
  };

  // ── DISCONNECT CONFIRM ────────────────────────────────────────────
  const renderDisconnect = () => {
    const info = getActiveTunnel();
    const lines = [];
    lines.push(`${tag(D.danger, bold('■  Disconnect Tunnel'))}`);
    lines.push(hr(48));
    lines.push('');
    if (!info) {
      lines.push(`  ${tag(D.muted, '⬤')}  No active tunnel to disconnect.`);
      lines.push('');
      lines.push(`  Press ${tag(D.accent, '[Esc]')} or ${tag(D.accent, '[h]')} to return home.`);
    } else {
      lines.push(`  ${tag(D.danger, '⚠')}  You are about to disconnect:`);
      lines.push('');
      lines.push(`  ${dim('Server')}  ${bold(info.server)}`);
      lines.push(`  ${dim('Mode  ')}  ${modeBadge(info.mode)}`);
      lines.push('');
      lines.push(hr(48));
      lines.push('');
      lines.push(`  Press ${tag(D.danger, bold('[y]'))} to confirm, or ${tag(D.accent, '[n]')} to cancel.`);
    }
    setView('disconnect', '\n' + lines.join('\n'), [['y', 'Confirm disconnect'], ['n/Esc', 'Cancel']]);
  };

  // ── HELP ─────────────────────────────────────────────────────────
  const renderHelp = () => {
    const lines = [];
    lines.push(`${tag(D.accent, bold('?  Keyboard Shortcuts'))}`);
    lines.push(hr(48));
    lines.push('');
    lines.push(`  ${tag(D.accent, bold('Navigation'))}`);
    lines.push('');
    lines.push(`  ${tag(D.accent, '↑ / ↓')}         Navigate menu items`);
    lines.push(`  ${tag(D.accent, 'Enter')}         Select / confirm action`);
    lines.push(`  ${tag(D.accent, 'Tab')}           Switch focus (sidebar ↔ panel)`);
    lines.push(`  ${tag(D.accent, 'Esc / Backspace')}  Go back / cancel`);
    lines.push(`  ${tag(D.accent, 'h')}             Go to Home`);
    lines.push(`  ${tag(D.accent, '?')}             Toggle this help`);
    lines.push(`  ${tag(D.accent, 'q / Ctrl+C')}   Quit Polaris`);
    lines.push('');
    lines.push(`  ${tag(D.accent, bold('Views'))}`);
    lines.push('');
    lines.push(`  ${tag(D.accent, '1')}             Home`);
    lines.push(`  ${tag(D.accent, '2')}             Servers`);
    lines.push(`  ${tag(D.accent, '3')}             Quick Connect`);
    lines.push(`  ${tag(D.accent, '4')}             Live Monitor`);
    lines.push(`  ${tag(D.accent, '5')}             Peers`);
    lines.push(`  ${tag(D.accent, '6')}             Privacy Check`);
    lines.push(`  ${tag(D.accent, '7')}             Deploy VPS`);
    lines.push('');
    lines.push(hr(48));
    lines.push('');
    lines.push(`  ${dim('Press')} ${tag(D.accent, '[?]')} ${dim('again or')} ${tag(D.accent, '[Esc]')} ${dim('to close.')}`);
    setView('help', '\n' + lines.join('\n'));
  };

  // ─────────────────────────────────────────────────────────────────
  //  SUSPEND TUI → RUN CMD → RESUME
  // ─────────────────────────────────────────────────────────────────
  const suspendAndRun = async (asyncFn) => {
    screen.destroy();
    process.stdout.write('\x1b[2J\x1b[0;0H');
    console.log('\x1b[36m\n  Polaris VPN\x1b[0m  \x1b[90m—\x1b[0m  \x1b[90mRunning command...\x1b[0m\n');
    try {
      await asyncFn();
    } catch (err) {
      console.error('\n\x1b[31m  Error:\x1b[0m', err.message);
    }
    console.log('\n\x1b[90m  ─────────────────────────────────────────────\x1b[0m');
    console.log('\x1b[36m  Press any key to return to Polaris...\x1b[0m');
    await new Promise(resolve => {
      process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.once('data', () => {
        process.stdin.setRawMode(false);
        process.stdin.pause();
        resolve();
      });
    });
    // Re-launch
    const m = await import('./tui.js');
    await m.default();
  };

  // ─────────────────────────────────────────────────────────────────
  //  CURRENT VIEW STATE
  // ─────────────────────────────────────────────────────────────────
  let currentView  = 'home';
  let helpVisible  = false;

  const navigateTo = async (viewId) => {
    currentView = viewId;
    helpVisible = viewId === 'help';

    switch (viewId) {
      case 'home':       renderHome();       break;
      case 'servers':    serverSelectIndex = 0; renderServers(); break;
      case 'check':      renderCheck();     break;
      case 'deploy':     renderDeploy();    break;
      case 'peers':      renderPeers();     break;
      case 'disconnect': renderDisconnect(); break;
      case 'help':       renderHelp();      break;

      case 'connect':
        await suspendAndRun(async () => {
          const run = (await import('./start.js')).default;
          await run({ mode: 'auto', json: false });
        });
        break;

      case 'dashboard':
        screen.destroy();
        const dash = (await import('./dashboard.js')).default;
        await dash();
        break;

      case 'quit':
        process.exit(0);
    }
  };

  // ─────────────────────────────────────────────────────────────────
  //  HANDLE NAVLIST SELECTION (hover hint)
  // ─────────────────────────────────────────────────────────────────
  navList.on('select item', (_, listIdx) => {
    const viewIdx = navMap[listIdx];
    if (viewIdx === null || viewIdx === undefined) return;
    const v = VIEWS[viewIdx];
    if (!v) return;
    sidebarHint.setContent(`\n  ${dim(v.icon + '  ' + v.label)}`);
    screen.render();
  });

  // ─────────────────────────────────────────────────────────────────
  //  HANDLE NAVLIST ENTER
  // ─────────────────────────────────────────────────────────────────
  navList.on('select', async (_, listIdx) => {
    const viewIdx = navMap[listIdx];
    if (viewIdx === null || viewIdx === undefined) return;
    const v = VIEWS[viewIdx];
    if (!v) return;
    await navigateTo(v.id);
  });

  // ─────────────────────────────────────────────────────────────────
  //  GLOBAL KEYBOARD SHORTCUTS
  // ─────────────────────────────────────────────────────────────────
  screen.key(['q', 'C-c'], () => process.exit(0));
  screen.key(['?'],  () => { helpVisible ? navigateTo('home') : navigateTo('help'); });
  screen.key(['h'],  () => navigateTo('home'));
  screen.key(['1'],  () => navigateTo('home'));
  screen.key(['2'],  () => navigateTo('servers'));
  screen.key(['3'],  () => navigateTo('connect'));
  screen.key(['4'],  () => navigateTo('dashboard'));
  screen.key(['5'],  () => navigateTo('peers'));
  screen.key(['6'],  () => navigateTo('check'));
  screen.key(['7'],  () => navigateTo('deploy'));

  screen.key(['escape', 'backspace'], () => {
    if (currentView !== 'home') navigateTo('home');
  });

  // ── Servers view: arrow nav within servers panel ──
  screen.key(['up'],   () => {
    if (currentView === 'servers') {
      const { profiles } = getProfiles();
      const names = Object.keys(profiles);
      if (names.length > 0) {
        serverSelectIndex = (serverSelectIndex - 1 + names.length) % names.length;
        renderServers();
      }
    }
  });
  screen.key(['down'], () => {
    if (currentView === 'servers') {
      const { profiles } = getProfiles();
      const names = Object.keys(profiles);
      if (names.length > 0) {
        serverSelectIndex = (serverSelectIndex + 1) % names.length;
        renderServers();
      }
    }
  });

  // ── Servers view: Enter to connect to selected ──
  screen.key(['enter'], async () => {
    if (currentView === 'servers') {
      const { profiles } = getProfiles();
      const names = Object.keys(profiles);
      if (names.length > 0) {
        const server = profiles[names[serverSelectIndex]];
        await suspendAndRun(async () => {
          const run = (await import('./start.js')).default;
          await run({ server, mode: 'auto', json: false });
        });
      }
    } else if (currentView === 'check') {
      await suspendAndRun(async () => {
        const run = (await import('./check.js')).default;
        await run({ json: false });
      });
    } else if (currentView === 'deploy') {
      await suspendAndRun(async () => {
        console.log('\n  \x1b[36mTo deploy, run:\x1b[0m');
        console.log('  \x1b[90mpolaris deploy --server ubuntu@<your-ip>\x1b[0m\n');
      });
    } else if (currentView === 'peers') {
      renderPeers(); // refresh
    }
  });

  // ── Disconnect confirm: y/n ──
  screen.key(['y'], async () => {
    if (currentView !== 'disconnect') return;
    await suspendAndRun(async () => {
      const run = (await import('./stop.js')).default;
      await run({ json: false });
    });
  });
  screen.key(['n'], () => {
    if (currentView === 'disconnect') navigateTo('home');
  });

  // ── Peers: refresh ──
  screen.key(['r'], () => {
    if (currentView === 'peers') renderPeers();
  });

  // ── Tab: switch focus ──
  screen.key(['tab'], () => {
    if (screen.focused === navList) {
      mainPanel.focus();
      sidebarBorder.style.border.fg = D.dim;
      mainPanel.style.border.fg     = D.accent;
    } else {
      navList.focus();
      sidebarBorder.style.border.fg = D.accent;
      mainPanel.style.border.fg     = D.accentDim;
    }
    screen.render();
  });

  // ─────────────────────────────────────────────────────────────────
  //  AUTO-REFRESH
  // ─────────────────────────────────────────────────────────────────
  const autoRefresh = () => {
    updateSidebarStatus();
    if (currentView === 'home') renderHome();
    if (currentView === 'peers') renderPeers();
    screen.render();
  };

  setInterval(autoRefresh, 4000);

  // ─────────────────────────────────────────────────────────────────
  //  INIT
  // ─────────────────────────────────────────────────────────────────
  sidebarBorder.style.border.fg = D.accent;
  updateSidebarStatus();
  defaultFooter();
  renderHome();

  navList.focus();
  screen.render();
};
