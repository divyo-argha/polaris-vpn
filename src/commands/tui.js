import blessed from 'blessed';
import contrib from 'blessed-contrib';
import startCommand from './start.js';
import stopCommand from './stop.js';

export default async () => {
  const screen = blessed.screen({
    smartCSR: true,
    title: 'Polaris VPN'
  });

  const grid = new contrib.grid({ rows: 12, cols: 12, screen: screen });

  // 1. Sidebar List
  const sidebar = grid.set(0, 0, 12, 3, blessed.list, {
    label: ' Menu ',
    keys: true,
    vi: true,
    mouse: true,
    style: {
      fg: 'white',
      border: { fg: 'cyan' },
      selected: { bg: 'cyan', fg: 'black', bold: true }
    },
    items: [
      '🚀 Quick Start',
      '📊 Dashboard',
      '🛑 Stop Tunnel',
      '🚪 Quit'
    ]
  });

  // 2. Main content panel
  const mainPanel = grid.set(0, 3, 11, 9, blessed.box, {
    label: ' Polaris VPN ',
    content: '\n  Welcome to Polaris.\n\n  Use the arrow keys to navigate the menu on the left,\n  and press Enter to select an action.\n\n  Tunnel Status: Checking...',
    tags: true,
    style: { border: { fg: 'cyan' } }
  });

  // 3. Footer
  const footer = grid.set(11, 3, 1, 9, blessed.box, {
    content: ' {bold}[↑/↓]{/bold} Navigate | {bold}[Enter]{/bold} Select | {bold}[q]{/bold} Quit',
    tags: true,
    style: { fg: 'yellow' }
  });

  // Helper to suspend TUI and run a standard CLI command
  const runCommand = async (cmdFn) => {
    screen.destroy();
    console.clear();
    try {
      await cmdFn({ mode: 'auto', json: false });
    } catch (err) {
      console.error(err);
    }
    
    console.log('\n\x1b[36mPress any key to return to menu...\x1b[0m');
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', () => {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      // Re-launch TUI
      import('./tui.js').then(m => m.default());
    });
  };

  sidebar.on('select', async (item, index) => {
    const text = item.getText();
    if (text.includes('Quick Start')) {
      await runCommand(startCommand);
    } else if (text.includes('Dashboard')) {
      screen.destroy();
      const dashboard = (await import('./dashboard.js')).default;
      await dashboard();
    } else if (text.includes('Stop Tunnel')) {
      await runCommand(stopCommand);
    } else if (text.includes('Quit')) {
      return process.exit(0);
    }
  });

  screen.key(['escape', 'q', 'C-c'], () => {
    return process.exit(0);
  });

  // Update status in main panel
  import('../core/tunnel-service.js').then(({ getActiveTunnel }) => {
    const info = getActiveTunnel();
    if (info) {
      mainPanel.setContent(`\n  {bold}Status:{/bold} {green-fg}CONNECTED{/green-fg}\n  {bold}Server:{/bold} ${info.server}\n  {bold}Mode:{/bold} ${info.mode.toUpperCase()}\n\n  Use 'Dashboard' to view live bandwidth.`);
    } else {
      mainPanel.setContent(`\n  {bold}Status:{/bold} {red-fg}DISCONNECTED{/red-fg}\n\n  Use 'Quick Start' to establish a secure tunnel.`);
    }
    screen.render();
  });

  sidebar.focus();
  screen.render();
};
