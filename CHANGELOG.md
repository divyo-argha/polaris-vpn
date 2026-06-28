# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2026-06-28

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
