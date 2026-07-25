# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-07-25

### Added

- **IPv6 Kill-Switch Enforcement**: `polaris killswitch on` now blocks all IPv6 OUTPUT traffic (not just IPv4) via `ip6tables` on Linux and `block drop inet6 all` in pf rules on macOS, eliminating the IPv6 VPN leak vector entirely.
- **Automatic WireGuard Key Rotation (`polaris rotate`)**: New command generates a fresh Curve25519 keypair, SSHes into the deployed server, replaces the peer's `PublicKey` in the WireGuard config, restarts the service, and writes a new local `.conf`. `polaris rotate --schedule 30` sets an automatic rotation interval; `polaris start` will notify when rotation is due.
- **Structured Event Log (`polaris logs`)**: All tunnel lifecycle events (CONNECT, DISCONNECT, DNS_START, DNS_STOP, KEY_ROTATE, ERROR) are now persisted as newline-delimited JSON to `~/.config/polaris/events.log`. `polaris logs` renders a color-coded table of the last 50 events. `polaris logs --tail` streams live output with `fs.watch`.
- **Profile Tagging & Group Start (`polaris tag`)**: Server profiles now support tags (e.g. `streaming`, `work`, `eu`). Use `polaris add <alias> --tag streaming` or `polaris tag <alias> streaming` to annotate profiles. `polaris start --tag streaming` benchmarks all tagged servers and auto-connects to the lowest-latency one.
- **Remote Server Updater (`polaris update-server`)**: SSHes into the deployed VPS and runs `apt-get upgrade` for WireGuard, AmneziaWG, Unbound, and Fail2Ban packages. No arguments needed if a server was previously deployed — reads `deploy.json` automatically. Supports `--server` and `--identity` overrides.
- **Homebrew Formula**: Added `docs/polaris-vpn.rb` — a valid Homebrew formula for macOS installation via `brew tap Divyo/tap && brew install polaris-vpn` (requires publishing to a `homebrew-tap` repo).
- **Expanded Test Suite**: Added 3 new test files (`logger.test.js`, `rotation.test.js`, `dns.test.js`) and extended `commands.test.js` and `benchmark.test.js` with tag-aware profile tests, rotation schedule tests, and TCP handshake timeout wall-clock verification.

## [1.2.3] - 2026-07-22

### Fixed & Improved

- **Standalone REST API Daemon (`polaris-server`)**: Added shebang and direct CLI execution parser to `src/commands/server.js` so `polaris-server` can be executed directly as a standalone process with `-p/--port` and `--json` support.
- **DoH Resolver Record Mapping**: Enhanced local DNS-over-HTTPS resolver in `src/net/dns-resolver.js` to correctly map `CNAME`, `PTR`, `NS`, `TXT`, and `MX` records using `dns2` domain formatting, with added null-safety checks.

## [1.2.2] - 2026-07-22

### Security & Fixed

- **TUI Accessibility & Recovery**: Added `renderErrorView` in-app error boundary and emergency navigation shortcuts (`[Esc]`, `[h]`, `[m]`, `[1]`) so TUI view failures or offline states never trap the user or crash the process.
- **Dependency Security Cleanup**: Replaced unmaintained `qrcode-terminal` with modern, actively maintained `qrcode` library to eliminate supply chain risks.
- **Vulnerability Patches**: Updated `fast-uri` dependency to resolve host confusion vulnerabilities (`GHSA-v2hh-gcrm-f6hx` / `GHSA-4c8g-83qw-93j6`), bringing `npm audit` to 0 vulnerabilities.

## [1.2.1] - 2026-07-22

### Security & Fixed

- **Dependency Security Cleanup**: Replaced unmaintained `qrcode-terminal` with modern, actively maintained `qrcode` library to eliminate supply chain risks.
- **Vulnerability Patches**: Updated `fast-uri` dependency to resolve host confusion vulnerabilities (`GHSA-v2hh-gcrm-f6hx` / `GHSA-4c8g-83qw-93j6`), bringing `npm audit` to 0 vulnerabilities.

## [1.2.0] - 2026-07-22

### Added

- **Auto-DoH System DNS Protection**: `polaris start` automatically launches the local DoH resolver (`127.0.0.1:5354`) and binds system DNS on macOS and Linux to eliminate ISP DNS leaks. System DNS is safely backed up and restored on `polaris stop`.
- **Split Tunneling / Bypass Rules (`polaris bypass`)**: Added `polaris bypass add/remove/list <domain|ip>` commands to route local LAN devices or specific streaming domains outside the VPN.
- **Server Latency Benchmark (`polaris benchmark`)**: Added `polaris benchmark` command to rank all saved profiles by ICMP ping latency and TCP handshake times.
- **Fastest Server Auto-Selection (`polaris start --fastest`)**: Added `--fastest` flag to benchmark saved profiles and auto-connect to the lowest-latency server.
- **Multi-Protocol Automatic Failover (`polaris start --failover`)**: Automatically falls back through protocols (`wireguard` → `amneziawg` → `tls` → `ssh`) if primary connection fails.
- **WireGuard / AmneziaWG Config Import (`polaris import`)**: Import third-party `.conf` files (`polaris import <file>`) from providers like Mullvad, ProtonVPN, or custom servers.
- **Profile Export & Mobile QR Codes (`polaris export`)**: Export saved profiles to `.conf` files (`polaris export <alias> --out <path>`) or render terminal QR codes for mobile setup.
- **TUI Shortcut Keys**: Added `b` shortcut key in master TUI to view live server latency benchmark rankings.

## [1.1.2] - 2026-07-22

### Fixed

- **Start Command**: Fixed `ReferenceError: config is not defined` crash when invoking `polaris start` without `--server` argument.
- **WireGuard & AmneziaWG Status**: Fixed `polaris status` and `polaris check` reporting false proxy failures for system-wide VPN interfaces.
- **AmneziaWG Bandwidth Monitoring**: Updated `polaris monitor`, `dashboard`, `status`, and TUI components to query `awg` interface statistics and accept `--mode amneziawg`.
- **Deploy Local Auto-Connect**: Updated `polaris deploy` to automatically trigger local connection passing correct server and mode arguments upon provisioning completion.
- **Status Table Formatting**: Replaced invalid SOCKS5 proxy port display (`socks5://127.0.0.1:0`) with clear `System-wide (All OS traffic)` label for WireGuard and AmneziaWG connections.

## [1.0.0] - 2026-07-15

### Added

- **Zero-Log Self-Hosted DNS (Unbound)**: `polaris deploy` now automatically installs and configures Unbound directly on the VPS, binding it to the tunnel interface (`10.0.0.1:53`). Client configs use this by default, ensuring your DNS queries never hit public resolvers (like Cloudflare) and never leave the encrypted tunnel.
- **Server Hardening (Fail2Ban)**: Deployment now automatically secures the VPS SSH port against automated botnet brute-force attacks by installing and enabling `fail2ban`.
- **Multi-Peer Management**: `polaris peer add <name>` allows you to provision additional client configurations dynamically on your existing WireGuard or AmneziaWG server. Use `polaris peer list` and `polaris peer remove <name>` to manage your peers.
- **Terminal QR Codes**: Automatically generate terminal-rendered QR codes using `polaris peer qr <name>` for instantly setting up mobile devices (iOS/Android).
- **System Kill Switch**: Run `polaris killswitch on` to drop all non-VPN outbound traffic (using `iptables` or `pf`) when the tunnel is active, ensuring zero IP leaks.

## [0.7.0] - 2026-07-12

### Added

- **AmneziaWG Stealth Mode**: Added full support for AmneziaWG obfuscated WireGuard tunnels. Use `--mode amneziawg` with `polaris deploy` and `polaris start` to bypass Deep Packet Inspection (DPI) with randomized junk packet sizes and headers.
- **Automated Obfuscation Params**: The CLI now automatically generates and manages unique AmneziaWG obfuscation parameters (`Jc`, `Jmin`, `Jmax`, `S1`, `S2`, `H1`-`H4`) without requiring manual user configuration.

## [0.6.0] - 2026-07-12

### Added

- **First-Class Windows Support**: Polaris now natively binds to `wireguard.exe` NT Services on Windows, bypassing the need for `wg-quick` and `sudo`. This makes Polaris fully cross-platform.
- **TUI Dashboard**: Added the `polaris dashboard` command, which launches a rich Terminal UI utilizing `blessed` and `blessed-contrib` to render live Rx/Tx bandwidth graphs, GeoIP server maps, and real-time WireGuard peer data.

## [0.5.0] - 2026-07-12

### Added

- **Server Health Dashboard**: `polaris status --full` now queries GeoIP data, tests ping latency directly to the server, and retrieves live WireGuard rx/tx data limits.
- **Auto-Updater**: Introduced `polaris update` and background update notifications via `update-notifier`.

## [0.4.0] - 2026-07-12

### Added

- **Live Bandwidth Monitor**: Use `polaris monitor` to see real-time up/down speeds, data usage, and peer activity for WireGuard tunnels.
- **Local REST API**: Use `polaris server start` to run a local API on `127.0.0.1:7070` for external integrations and status queries.

## [0.3.1] - 2026-06-28

### Added
- Companion `polaris-server` dynamic HTTP/TLS forwarding proxy on port 8443.
- local DNS-over-HTTPS (DoH) resolver command namespace (`polaris dns start/stop/status`) on port 5354.
- TLS tunnel client option (`polaris start --mode tls`).
- Auto-reconnect with exponential backoff & keepalive monitoring.
- Desktop alerts/notifications via `node-notifier`.
- Refactored codebase to highly modular MVC structure with centralized configurations and daemon manager.
- Static runner scripts to ensure full compatibility with global NPM installation permissions.

## [0.1.0] - 2026-06-27

### Added

- MVP release of Polaris CLI.
- `polaris start`: Setup a SOCKS5 SSH proxy.
- `polaris stop`: Stop the active tunnel.
- `polaris status`: Check tunnel status.
- `polaris check`: 3-point privacy leak check (IP, DNS, IPv6).
- `polaris add/list/use`: Save and manage server profiles.
