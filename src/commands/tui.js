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

// ─────────────────────────────────────────────────────────
//  Colour palette (xterm-256 colour indices)
// ─────────────────────────────────────────────────────────
const C = {
  accent:     '#00d7ff',   // bright cyan
  accentDim:  '#005f87',   // deep blue
  success:    '#00ff87',   // mint green
  danger:     '#ff5f5f',   // soft red
  warning:    '#ffaf00',   // amber
  dim:        '#626262',   // grey
  text:       '#e4e4e4',   // near-white
  bg:         'black',
  highlight:  '#005f87',
};

// ─────────────────────────────────────────────────────────
//  Logo banner (shows at top-right)
// ─────────────────────────────────────────────────────────
const LOGO = [
  `{#00d7ff-fg}{bold}  ██████╗  ██████╗ ██╗      █████╗ ██████╗ ██╗███████╗{/bold}{/}`,
  `{#00d7ff-fg}{bold}  ██╔══██╗██╔═══██╗██║     ██╔══██╗██╔══██╗██║██╔════╝{/bold}{/}`,
  `{#00afff-fg}{bold}  ██████╔╝██║   ██║██║     ███████║██████╔╝██║███████╗{/bold}{/}`,
  `{#0087d7-fg}{bold}  ██╔═══╝ ██║   ██║██║     ██╔══██║██╔══██╗██║╚════██║{/bold}{/}`,
  `{#005faf-fg}{bold}  ██║     ╚██████╔╝███████╗██║  ██║██║  ██║██║███████║{/bold}{/}`,
  `{#005faf-fg}{bold}  ╚═╝      ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝╚══════╝{/bold}{/}`,
  `{${C.dim}-fg}  Leave no trace.   v${pkg.version}  —  Your True North in Digital Privacy.{/}`,
].join('\n');

// ─────────────────────────────────────────────────────────
//  Menu items with metadata
// ─────────────────────────────────────────────────────────
const MENU = [
  { id: 'home',      label: '  Home',               icon: '◈', hint: 'Status overview'           },
  { id: 'start',     label: '  Quick Connect',       icon: '▶', hint: 'Start a secure tunnel'     },
  { id: 'dashboard', label: '  Live Dashboard',      icon: '◉', hint: 'Bandwidth & map view'      },
  { id: 'stop',      label: '  Disconnect',          icon: '■', hint: 'Tear down active tunnel'   },
  { id: 'deploy',    label: '  Deploy Server',       icon: '⊕', hint: 'Provision a new VPS'       },
  { id: 'check',     label: '  Privacy Check',       icon: '✦', hint: 'IP, DNS & IPv6 leak test'  },
  null, // separator
  { id: 'quit',      label: '  Quit',                icon: '✕', hint: 'Exit Polaris'              },
];

const formatMenuItem = (item) => {
  if (!item) return `{${C.dim}-fg}  ──────────────────{/}`;
  return `{${C.dim}-fg}${item.icon}{/}${item.label}`;
};

const pingServer = (ip) => {
  if (!ip) return 'N/A';
  const isWin = os.platform() === 'win32';
  const args = isWin ? ['-n', '1', '-w', '1000', ip] : ['-c', '1', '-W', '1', ip];
  const res = spawnSync('ping', args, { encoding: 'utf-8' });
  if (res.status === 0) {
    const match = res.stdout.match(isWin ? /Average = (\d+)ms/ : /time=([\d.]+)\s*ms/);
    if (match) return `${match[1]} ms`;
  }
  return 'Timeout';
};

// ─────────────────────────────────────────────────────────
//  Main TUI entrypoint
// ─────────────────────────────────────────────────────────
export default async () => {
  // Lazy load tunnel service
  const { getActiveTunnel } = await import('../core/tunnel-service.js');

  const screen = blessed.screen({
    smartCSR: true,
    title: `Polaris VPN v${pkg.version}`,
    fullUnicode: true,
    dockBorders: true,
  });

  // ── Top header bar ──────────────────────────────────────
  const header = blessed.box({
    parent: screen,
    top: 0,
    left: 0,
    width: '100%',
    height: 8,
    tags: true,
    content: LOGO,
    style: {
      bg: C.bg,
      fg: C.text,
    },
  });

  // ── Thin separator line ────────────────────────────────
  blessed.line({
    parent: screen,
    top: 8,
    left: 0,
    orientation: 'horizontal',
    width: '100%',
    style: { fg: C.accentDim },
  });

  // ── LEFT Sidebar ────────────────────────────────────────
  const sidebar = blessed.list({
    parent: screen,
    top: 9,
    left: 0,
    width: 26,
    bottom: 3,
    label: `{${C.accent}-fg} NAVIGATE {/}`,
    tags: true,
    keys: true,
    vi: true,
    mouse: true,
    scrollable: false,
    items: MENU.map(formatMenuItem),
    style: {
      fg: C.text,
      bg: C.bg,
      border: { fg: C.accentDim, bg: C.bg },
      selected: { bg: C.highlight, fg: '#ffffff', bold: true },
      item: { fg: C.text },
    },
    border: { type: 'line' },
  });

  // ── RIGHT Main panel ────────────────────────────────────
  const mainPanel = blessed.box({
    parent: screen,
    top: 9,
    left: 26,
    right: 0,
    bottom: 3,
    label: `{${C.accent}-fg} POLARIS VPN {/}`,
    tags: true,
    scrollable: true,
    alwaysScroll: true,
    keys: true,
    mouse: true,
    content: '',
    style: {
      fg: C.text,
      bg: C.bg,
      border: { fg: C.accentDim, bg: C.bg },
    },
    border: { type: 'line' },
    padding: { left: 2, right: 2, top: 1 },
  });

  // ── Status bar (footer) ─────────────────────────────────
  const footer = blessed.box({
    parent: screen,
    bottom: 0,
    left: 0,
    width: '100%',
    height: 3,
    tags: true,
    content: ` {${C.accent}-fg}[↑/↓]{/} Navigate  {${C.accent}-fg}[Enter]{/} Select  {${C.accent}-fg}[q]{/} Quit  {${C.accent}-fg}[Tab]{/} Switch Focus`,
    style: {
      fg: C.dim,
      bg: C.bg,
      border: { fg: C.accentDim },
    },
    border: { type: 'line' },
  });

  // ── Small status pill (top-right of footer) ─────────────
  const statusPill = blessed.box({
    parent: screen,
    bottom: 0,
    right: 2,
    width: 28,
    height: 3,
    tags: true,
    content: '',
    style: { fg: C.dim, bg: C.bg },
  });

  // ─────────────────────────────────────────────────────────
  //  Render helpers
  // ─────────────────────────────────────────────────────────
  const updateStatusPill = () => {
    const info = getActiveTunnel();
    if (info) {
      statusPill.setContent(`{${C.success}-fg}⬤  CONNECTED{/} {${C.dim}-fg}${info.mode.toUpperCase()}{/}`);
    } else {
      statusPill.setContent(`{${C.danger}-fg}⬤  DISCONNECTED{/}`);
    }
  };

  // Track selected menu index (skip separators)
  let selectedIndex = 0;

  const renderHome = () => {
    const info = getActiveTunnel();
    const lines = [];

    if (info) {
      const uptimeMin = Math.floor((Date.now() - new Date(info.startTime).getTime()) / 60000);
      const serverIp = info.server.split('@').pop();
      const ping = pingServer(serverIp);

      lines.push(`{${C.accent}-fg}{bold}  ◈ Tunnel Status{/bold}{/}`);
      lines.push(`  {${C.dim}-fg}────────────────────────────────────────{/}`);
      lines.push('');
      lines.push(`  {${C.dim}-fg}State   {/}{${C.success}-fg}⬤  CONNECTED{/}`);
      lines.push(`  {${C.dim}-fg}Server  {/}{bold}${info.server}{/bold}`);
      lines.push(`  {${C.dim}-fg}Mode    {/}{${C.accent}-fg}${info.mode.toUpperCase()}{/}`);
      lines.push(`  {${C.dim}-fg}Uptime  {/}${uptimeMin} min`);
      lines.push(`  {${C.dim}-fg}Latency {/}${ping}`);
      lines.push('');
      lines.push(`  {${C.dim}-fg}────────────────────────────────────────{/}`);
      lines.push(`  {${C.dim}-fg}Select {/}{${C.accent}-fg}Live Dashboard{/}{${C.dim}-fg} for real-time bandwidth stats.{/}`);
    } else {
      lines.push(`{${C.accent}-fg}{bold}  ◈ Welcome to Polaris{/bold}{/}`);
      lines.push(`  {${C.dim}-fg}────────────────────────────────────────{/}`);
      lines.push('');
      lines.push(`  {${C.dim}-fg}State   {/}{${C.danger}-fg}⬤  DISCONNECTED{/}`);
      lines.push('');
      lines.push(`  No active tunnel found.`);
      lines.push(`  Select {${C.accent}-fg}Quick Connect{/} to start a secure session.`);
      lines.push('');
      lines.push(`  {${C.dim}-fg}────────────────────────────────────────{/}`);
      lines.push(`  {${C.accent}-fg}Tip:{/} {${C.dim}-fg}Run {/}{${C.accent}-fg}polaris deploy{/}{${C.dim}-fg} to provision a free VPS.{/}`);
    }

    mainPanel.setLabel(`{${C.accent}-fg} HOME {/}`);
    mainPanel.setContent(lines.join('\n'));
    screen.render();
  };

  const renderHint = (item) => {
    if (!item) return;
    const lines = [
      '',
      `{${C.accent}-fg}{bold}  ${item.icon} ${item.label.trim()}{/bold}{/}`,
      `  {${C.dim}-fg}────────────────────────────────────────{/}`,
      '',
      `  {${C.dim}-fg}${item.hint}{/}`,
      '',
      `  Press {${C.accent}-fg}[Enter]{/} to continue.`,
    ];
    mainPanel.setLabel(`{${C.accent}-fg} ${item.label.trim().toUpperCase()} {/}`);
    mainPanel.setContent(lines.join('\n'));
    screen.render();
  };

  // ─────────────────────────────────────────────────────────
  //  Sidebar navigation — skip separator rows
  // ─────────────────────────────────────────────────────────
  const menuItems = MENU.filter(Boolean);

  sidebar.on('select item', (_, i) => {
    // Find the menu item corresponding to index i
    const nonNull = MENU.reduce((acc, item, idx) => {
      if (item) acc.push({ item, idx });
      return acc;
    }, []);
    // Map visual list index to menu item
    const entry = MENU[i];
    if (!entry) return; // separator
    selectedIndex = i;

    if (entry.id === 'home') {
      renderHome();
    } else {
      renderHint(entry);
    }
  });

  // ─────────────────────────────────────────────────────────
  //  Helper to suspend TUI, run command, return to menu
  // ─────────────────────────────────────────────────────────
  const suspendAndRun = async (asyncFn) => {
    screen.destroy();
    process.stdout.write('\x1b[2J\x1b[0f'); // clear screen
    try {
      await asyncFn();
    } catch (err) {
      console.error('\n\x1b[31mError:\x1b[0m', err.message);
    }
    console.log(`\n\x1b[36m  Press any key to return to the Polaris menu...\x1b[0m`);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      import('./tui.js').then(m => m.default());
    });
  };

  sidebar.on('select', async (item, i) => {
    const entry = MENU[i];
    if (!entry) return;

    switch (entry.id) {
      case 'home':
        renderHome();
        break;

      case 'start':
        await suspendAndRun(async () => {
          const run = (await import('./start.js')).default;
          await run({ mode: 'auto', json: false });
        });
        break;

      case 'dashboard':
        screen.destroy();
        await (await import('./dashboard.js')).default();
        break;

      case 'stop':
        await suspendAndRun(async () => {
          const run = (await import('./stop.js')).default;
          await run({ json: false });
        });
        break;

      case 'deploy':
        await suspendAndRun(async () => {
          const { promptSelection } = await import('../utils/display.js');
          const { printBox } = await import('../utils/display.js');
          console.log('\n\x1b[36m  Deploy a New WireGuard/AmneziaWG Server\x1b[0m');
          console.log('\x1b[90m  ─────────────────────────────────────────\x1b[0m\n');
          console.log('  To deploy, run: \x1b[36mpolaris deploy --server <user@host>\x1b[0m\n');
        });
        break;

      case 'check':
        await suspendAndRun(async () => {
          const run = (await import('./check.js')).default;
          await run({ json: false });
        });
        break;

      case 'quit':
        process.exit(0);
        break;
    }
  });

  // ─────────────────────────────────────────────────────────
  //  Tab key to switch focus between sidebar and panel
  // ─────────────────────────────────────────────────────────
  screen.key(['tab'], () => {
    if (screen.focused === sidebar) {
      mainPanel.focus();
      sidebar.style.border.fg = C.dim;
      mainPanel.style.border.fg = C.accent;
    } else {
      sidebar.focus();
      sidebar.style.border.fg = C.accent;
      mainPanel.style.border.fg = C.accentDim;
    }
    screen.render();
  });

  screen.key(['escape', 'q', 'C-c'], () => process.exit(0));

  // ─────────────────────────────────────────────────────────
  //  Auto-refresh status pill every 5 seconds
  // ─────────────────────────────────────────────────────────
  updateStatusPill();
  renderHome();
  setInterval(() => {
    updateStatusPill();
    screen.render();
  }, 5000);

  sidebar.style.border.fg = C.accent;
  sidebar.focus();
  screen.render();
};
