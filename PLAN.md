# Polaris VPN Release Plan & Implementation Guide

This document tracks the actual implementation and publishing steps for the remaining features (v0.4.0 through v1.0.0). We will implement the actual code ("real work") for each milestone, followed by its respective documentation and version bumps, preparing the granular commits.

---

## 📦 v0.4.0: Observation & API Release
**Features to build:**
- **Local REST API**: Build an Express server in `src/server/api.js` and a `polaris server start` command.
- **Bandwidth Monitor**: Build a live dashboard in `src/commands/monitor.js`.

### Execution Steps for v0.4.0:
- **[x] feat(api):** Write `src/server/api.js` and register `polaris server start` in `cli.js`.
- **[x] feat(monitor):** Write `src/commands/monitor.js` and register `polaris monitor` in `cli.js`.
- **[x] docs(readme):** Document `polaris monitor` and `polaris server start` commands.
- **[x] docs(changelog):** Add `[0.4.0]` release notes.
- **[x] chore(release):** Bump `package.json` version to `0.4.0` and test.

---

## 📦 v0.5.0: Health & Maintenance Release
**Features to build:**
- **Server Health Dashboard**: Enhance `status.js` with `--full` to ping the server, do GeoIP lookups, and fetch WG rx/tx data.
- **Auto-updater**: Integrate `update-notifier` and a `polaris update` command using `npm install -g polaris-vpn@latest`.

### Execution Steps for v0.5.0:
- **[x] feat(health):** Implement `--full` flag in `status.js` with GeoIP and latency pings.
- **[x] feat(updater):** Implement `polaris update` command and background check in `cli.js`.
- **[x] docs(readme):** Document `--full` and `update`.
- **[x] docs(changelog):** Add `[0.5.0]` release notes.
- **[x] chore(release):** Bump `package.json` version to `0.5.0` and test.

---

## 📦 v0.6.0: Cross-Platform Release
**Features to build:**
- **Windows Native Service**: Enhance `wg.js` to use `wireguard.exe /installtunnelservice` instead of `sudo wg-quick` when `os.platform() === 'win32'`.

### Execution Steps for v0.6.0:
- **[x] feat(windows):** Add native NT service bindings in `src/tunnel/wg.js`.
- **[x] docs(readme):** Add Windows-specific setup instructions.
- **[x] docs(changelog):** Add `[0.6.0]` release notes.
- **[x] chore(release):** Bump `package.json` version to `0.6.0`.

---

## 🚀 v0.7.0: Stealth Release
**Features to build:**
- **AmneziaWG Support**: Introduce `amneziawg` mode in `start.js`. 
- Generate Amnezia-specific obfuscation parameters (Jc, Jmin, Jmax, S1, S2, H1, H2, H3, H4) in `wg.js`.
- Modify `deploy-service.js` to install AmneziaWG instead of WireGuard if `mode === 'amneziawg'`.

### Execution Steps for v0.7.0:
- [x] feat(tunnel): Add obfuscation parameters generation in `src/tunnel/wg.js`.
- [x] feat(deploy): Add server-side AmneziaWG installation logic in `deploy-service.js`.
- [x] feat(cli): Add `amneziawg` mode to `start.js`.
- [x] docs(changelog): Add `[0.7.0]` release notes.
- [x] chore(release): Bump `package.json` version to `0.7.0`.
