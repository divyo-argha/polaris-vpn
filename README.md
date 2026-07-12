# polaris — Leave no trace

![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)

Your True North in Digital Privacy. `polaris` is a production-quality, open-source, self-hosted VPN CLI tool. It wraps SSH dynamic port forwarding into a beautiful CLI experience.

### Prerequisites

- Node.js (v18+)
- SSH access to a remote Linux VPS (Ubuntu/Debian recommended)
- **Linux/macOS**: `sudo` privileges for configuring WireGuard and network routes locally.
- **Windows**: The official [WireGuard for Windows](https://www.wireguard.com/install/) client must be installed, and `polaris` must be run from an Administrator prompt.

We highly recommend **Oracle Cloud Free Tier** for your VPS.

## Install

```bash
npm install -g polaris-vpn
```

## Quickstart (30 seconds)

Once you have your server's IP address and SSH credentials (e.g. `ubuntu@1.2.3.4`), just run:

```bash
polaris start --server ubuntu@1.2.3.4
```

This will instantly create an encrypted SOCKS5 proxy on `127.0.0.1:1080` and route your traffic through it.

Verify it's working:

```bash
polaris check
```

When you're done:

```bash
polaris stop
```

## Command Reference

| Command | Description |
| --- | --- |
| `polaris start --server user@host [--port 1080]` | Start the encrypted SSH tunnel. |
| `polaris stop` | Stop the active tunnel. |
| `polaris dashboard` | Opens a rich Terminal User Interface (TUI) with real-time stats. |
| `polaris status [--full]` | Show current tunnel status. `--full` shows GeoIP, ping latency, and WG stats. |
| `polaris monitor` | Live bandwidth monitor for WireGuard tunnels. |
| `polaris check` | Run a 3-point privacy check (IP, DNS leak, IPv6 leak). |
| `polaris add <alias> --server user@host` | Save a server profile for quick access. |
| `polaris list` | List all saved server profiles. |
| `polaris use <alias>` | Set a saved profile as the active default. |
| `polaris server start` | Start a local REST API on `127.0.0.1:7070`. |
| `polaris update` | Update `polaris-vpn` to the latest version via npm. |

#### `polaris dashboard`
Opens a rich Terminal User Interface (TUI) with real-time graphs, server location maps, and live statistics (Rx/Tx, Ping).

#### `polaris status [--full]`
Displays the connection state, mode, current proxy IP, and active server. Use `--full` to query GeoIP and ping latency.

#### `polaris monitor`
Live bandwidth monitor that actively graphs the download and upload speeds of your tunnel.

#### `polaris check`
Checks if your IP matches the proxy, tests for DNS leaks via `ipleak.net`, and verifies IPv6 routing.

> All commands support the `--json` flag for machine-readable output.

## Oracle Cloud Free Tier Setup

The recommended free server is Oracle Cloud Always Free tier:

- **ARM VM (A1.Flex)**: 2 OCPUs, 12 GB RAM — completely free forever.
- 10 TB outbound bandwidth/month — more than enough for personal use.
- Best regions from South/Southeast Asia: India (Hyderabad) ~30ms, Singapore ~50ms, Japan (Tokyo) ~80ms.
- Sign up at [cloud.oracle.com](https://cloud.oracle.com) (requires a credit card for verification but charges nothing for Always Free resources).
- After VM creation, just grab the IP and SSH key, and run `polaris start --server ubuntu@<your-oracle-ip>`.

## Shared Server Model

One Oracle VM can serve multiple people:

- Light browsing (1–2 Mbps/user): 25–50 people comfortably.
- YouTube/social (5 Mbps/user): 8–10 people simultaneously.
- One person owns the VM, others get SSH keys.
- Or each person creates their own free Oracle account for full isolation.

## How It Works

`polaris` uses standard SSH dynamic port forwarding (`-D` flag) behind the scenes. It sets up a secure, encrypted tunnel from your local machine to your server, and exposes a local SOCKS5 proxy. This gives you instant VPN-like privacy without installing *any* server-side software.

## Trust Model

- **You own the server**: No reliance on third-party VPN providers.
- **Zero telemetry**: No tracking, no crash reporting, no analytics.
- **No central infra**: We run nothing. You bring your own VPS.
- **Open Source**: Apache 2.0 licensed, fully auditable.

## Roadmap

- **v0.1**: MVP — SSH SOCKS5 tunnel (Current)
- **v0.2**: TLS tunnel + DNS-over-HTTPS + leak checker
- **v0.5**: WireGuard full tunnel + server provisioning
- **v1.0**: AmneziaWG stealth mode + multi-peer + QR codes + kill switch

## Contributing

Contributions, issues, and feature requests are welcome!

## License

Apache 2.0
