import { printError, printBox } from './display.js';
import chalk from 'chalk';

export const getRemediation = (msg = '', err = null) => {
  const text = `${msg} ${err?.message || ''} ${err?.code || ''}`.toLowerCase();

  if (text.includes('wg-quick: command not found') || text.includes('awg-quick: command not found') || text.includes('wireguard-tools')) {
    return [
      'WireGuard CLI tools are missing on your machine.',
      'Install them using your package manager:',
      '  • macOS:          brew install wireguard-tools',
      '  • Ubuntu/Debian:  sudo apt install wireguard-tools',
      '  • Fedora/RHEL:    sudo dnf install wireguard-tools',
      '  • Arch Linux:     sudo pacman -S wireguard-tools'
    ];
  }

  if (text.includes('eaddrinuse') || text.includes('address already in use')) {
    return [
      'The requested port is already in use by another process.',
      '  • Stop existing Polaris tunnel: polaris stop',
      '  • Or select a different port:   polaris start -p 1085'
    ];
  }

  if (text.includes('permission denied (publickey)') || text.includes('all configured authentication methods failed')) {
    return [
      'SSH public key authentication failed.',
      '  • Verify your SSH key:    ssh -i ~/.ssh/id_rsa user@host',
      '  • Pass explicit key path: polaris deploy -s user@host -i ~/.ssh/id_rsa',
      '  • Or use SSH password:    polaris deploy -s user@host -p "password"'
    ];
  }

  if (text.includes('eacces') || text.includes('operation not permitted') || text.includes('sudo: a password is required')) {
    return [
      'Root permissions are required to configure VPN network routes and kill-switch.',
      '  • Run the command with sudo: sudo polaris ...',
      '  • Or verify passwordless sudo in /etc/sudoers for network tools'
    ];
  }

  if (text.includes('connection timed out') || text.includes('econnrefused') || text.includes('etimedout')) {
    return [
      'Could not establish connection to the remote VPS.',
      '  • Check VPS status and confirm the server is running',
      '  • Ensure UDP port 51820 (WireGuard) or TCP port 22 (SSH) are allowed in cloud security lists',
      '  • On Oracle Cloud: check VCN Security List Ingress Rules'
    ];
  }

  if (text.includes('no profiles found') || text.includes('no server specified')) {
    return [
      'No saved server profile was found.',
      '  • Deploy a new VPS server: polaris deploy -s user@host',
      '  • Or save an existing one:  polaris add my-vps -s user@host'
    ];
  }

  return null;
};

export const handleError = (msg, err, isJson = false) => {
  const isDebug = process.argv.includes('--debug');
  const remediation = getRemediation(msg, err);

  if (isJson) {
    const errorOutput = {
      error: msg,
      details: err ? err.message : undefined,
      remediation: remediation || undefined
    };
    if (isDebug && err && err.stack) {
      errorOutput.stack = err.stack;
    }
    console.log(JSON.stringify(errorOutput));
  } else {
    printError(msg, err);

    if (remediation && remediation.length > 0) {
      console.log('\n' + chalk.yellow.bold('💡 Actionable Remediation:'));
      remediation.forEach(line => console.log('   ' + chalk.dim(line)));
      console.log('');
    }

    if (isDebug && err && err.stack) {
      console.error('\n' + err.stack);
    }
  }
  process.exitCode = 1;
};

