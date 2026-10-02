import { getProfiles } from '../core/profile-service.js';

/**
 * Returns list of main subcommands and flags.
 */
const COMMANDS = [
  'start', 'stop', 'status', 'dashboard', 'check', 'list', 'use',
  'remove', 'rm', 'add', 'dns', 'deploy', 'killswitch', 'peer',
  'bypass', 'import', 'export', 'config', 'monitor', 'logs',
  'rotate', 'tag', 'update-server', 'speedtest', 'watchdog',
  'completion', 'setup'
];

const MODES = ['wireguard', 'amneziawg', 'tls', 'ssh', 'auto'];

/**
 * Generates bash completion script.
 */
export const generateBashCompletion = () => {
  return `
# Polaris VPN bash completion script
_polaris_completions() {
  local cur prev words cword
  _init_completion || return

  local commands="${COMMANDS.join(' ')}"
  local modes="${MODES.join(' ')}"

  # Dynamic profile aliases from polaris config
  local aliases
  if command -v node >/dev/null 2>&1; then
    aliases=$(node -e "
      try {
        const { getProfiles } = await import('${new URL('../core/profile-service.js', import.meta.url).pathname}');
        console.log(Object.keys(getProfiles().profiles).join(' '));
      } catch(e) {}
    " 2>/dev/null)
  fi

  case "\${prev}" in
    use|remove|rm|export|tag)
      COMPREPLY=( $(compgen -W "\${aliases}" -- "\${cur}") )
      return 0
      ;;
    -m|--mode)
      COMPREPLY=( $(compgen -W "\${modes}" -- "\${cur}") )
      return 0
      ;;
    -u|--upstream)
      COMPREPLY=( $(compgen -W "cloudflare google quad9" -- "\${cur}") )
      return 0
      ;;
    completion)
      COMPREPLY=( $(compgen -W "bash zsh fish" -- "\${cur}") )
      return 0
      ;;
  esac

  if [[ "\${cword}" -eq 1 ]]; then
    COMPREPLY=( $(compgen -W "\${commands}" -- "\${cur}") )
    return 0
  fi
}

complete -F _polaris_completions polaris
`;
};

/**
 * Generates zsh completion script.
 */
export const generateZshCompletion = () => {
  return `
#compdef polaris
# Polaris VPN zsh completion script

_polaris() {
  local -a commands modes aliases

  commands=(
    'start:Start encrypted VPN tunnel'
    'stop:Stop active tunnel'
    'status:Show current tunnel status and metrics'
    'dashboard:Launch live TUI dashboard'
    'check:Run 4-point privacy and leak diagnostic'
    'list:List all saved server profiles'
    'use:Set a saved profile as the active default'
    'remove:Delete a saved server profile'
    'rm:Delete a saved server profile'
    'add:Save a new server profile'
    'dns:Manage local DNS-over-HTTPS resolver'
    'deploy:Provision a remote VPS server'
    'killswitch:Manage network kill switch'
    'peer:Manage WireGuard client peers and QR codes'
    'bypass:Configure split-tunnel routing rules'
    'import:Import .conf configuration'
    'export:Export profile configuration file or QR'
    'config:Configure polaris settings'
    'monitor:Live bandwidth monitor'
    'logs:View structured event logs'
    'rotate:Rotate cryptographic keypairs'
    'tag:Tag a server profile'
    'update-server:Push VPN security updates to VPS'
    'speedtest:Benchmark latency and throughput'
    'watchdog:Monitor tunnel health and gateway heartbeat'
    'completion:Generate shell autocompletion script'
    'setup:Interactive onboarding and health check wizard'
  )

  modes=('wireguard' 'amneziawg' 'tls' 'ssh' 'auto')

  if (( CURRENT == 2 )); then
    _describe -t commands 'polaris commands' commands
    return 0
  fi

  case "$words[2]" in
    use|remove|rm|export|tag)
      local -a profile_list
      profile_list=($(node -e "
        try {
          const { getProfiles } = await import('${new URL('../core/profile-service.js', import.meta.url).pathname}');
          console.log(Object.keys(getProfiles().profiles).join(' '));
        } catch(e) {}
      " 2>/dev/null))
      _values 'server profiles' $profile_list
      ;;
    start)
      _arguments \\
        '(-m --mode)'{-m,--mode}'[Tunnel mode]:mode:(wireguard amneziawg tls ssh auto)' \\
        '(-s --server)'{-s,--server}'[Remote server]:server:_hosts' \\
        '(-p --port)'{-p,--port}'[Local SOCKS5 port]:port:' \\
        '--fastest[Auto-select lowest latency server profile]' \\
        '--tag[Connect to server matching tag]:tag:'
      ;;
    completion)
      _values 'shell' bash zsh fish
      ;;
  esac
}

compdef _polaris polaris
`;
};

/**
 * Generates fish completion script.
 */
export const generateFishCompletion = () => {
  return `
# Polaris VPN fish completion script
complete -c polaris -f

# Commands
${COMMANDS.map(cmd => `complete -c polaris -n "__fish_use_subcommand" -a "${cmd}"`).join('\n')}

# Options
complete -c polaris -n "__fish_seen_subcommand_from start" -s m -l mode -a "${MODES.join(' ')}" -d "Tunnel protocol"
complete -c polaris -n "__fish_seen_subcommand_from completion" -a "bash zsh fish" -d "Target shell"
`;
};

export default async (shell, options = {}) => {
  const targetShell = (shell || '').toLowerCase() || 'bash';

  let script;
  switch (targetShell) {
    case 'zsh':
      script = generateZshCompletion();
      break;
    case 'fish':
      script = generateFishCompletion();
      break;
    case 'bash':
    default:
      script = generateBashCompletion();
      break;
  }

  if (options.json) {
    console.log(JSON.stringify({ shell: targetShell, script }));
  } else {
    console.log(script.trim());
  }
};
