# Polaris VPN


**Command your privacy.**

[![NPM Version](https://img.shields.io/npm/v/polaris-vpn?color=88c0d0&label=npm&style=flat-square)](https://www.npmjs.com/package/polaris-vpn)
[![License](https://img.shields.io/badge/license-Apache%202.0-5e81ac?style=flat-square)](https://github.com/Divyo/polaris-vpn)
[![Node version](https://img.shields.io/badge/node-%3E%3D%2018.0.0-a3be8c?style=flat-square)](https://nodejs.org)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-ebcb8b?style=flat-square)

A production-grade, self-hosted VPN CLI with a beautiful Terminal User
Interface (TUI).

Deploy an enterprise-grade WireGuard or Stealth VPN in under 60 seconds.

---

## ✨ Features

- **🚀 Automated Deployment**: Instantly provision a WireGuard or AmneziaWG VPN
  on any fresh Linux VPS.
- **🎨 Beautiful TUI**: A master dashboard with real-time bandwidth
  monitoring, ping latency, and server locations.
- **🔒 Auto-DoH & DNS Protection**: Automatically binds system DNS to local DoH resolver (`127.0.0.1:5354`) on connection, preventing ISP DNS leaks.
- **⚡ Latency Benchmark & Auto-Selection**: Run `polaris benchmark` or use `polaris start --fastest` to auto-connect to the lowest-latency server.
- **🔀 Split Tunneling / Bypass Rules**: Route local LAN or specific domains around the VPN using `polaris bypass add <domain|ip>`.
- **📁 Import & Export `.conf` Files**: Import third-party WireGuard/AmneziaWG configs (`polaris import <file>`) or export profile QR codes (`polaris export <alias>`).
- **🛡️ Smart Kill-Switch**: Native OS firewall integration (`pf` for Mac, `iptables` for Linux) that ensures 0 leaks.
- **👻 Stealth Mode**: DPI (Deep Packet Inspection) bypass using AmneziaWG to defeat state-level censorship.
- **🔗 Multi-Protocol Failover**: `polaris start --failover` automatically falls back through protocols (`wireguard` → `amneziawg` → `tls` → `ssh`) if blocked.
- **☁️ Own Your Infra**: We run no servers. You bring your own VPS (Oracle Free Tier recommended).

## 📦 Installation

```bash
npm install -g polaris-vpn
```

Requires Node.js 18+

## ⚡ Quick Start

Got a fresh Linux VPS? Let Polaris set everything up for you.

```bash
# 1. Provision the server automatically
polaris deploy --server root@1.2.3.4 --mode amneziawg

# 2. Connect to your new VPN with Auto-DoH & System DNS Protection
polaris start --server root@1.2.3.4
```

> **Pro Tip**: Run `polaris add my-server --server root@1.2.3.4`
> so you can just type `polaris start` or `polaris start --fastest` next time!

## 🖥️ The Dashboard

Experience the modern terminal UI by running:

```bash
polaris
```

Use your **Arrow Keys** to navigate through:

- **Home**: Quick connect/disconnect and privacy check tools.
- **Live Monitor**: Watch your real-time Rx/Tx bandwidth graphs and server latency.
- **Peers**: Add or revoke VPN access for friends, or generate a QR code for your phone.
- **Settings**: Manage your saved server profiles.
- **Keyboard Shortcuts**: Press `b` in the TUI to view live server latency benchmark rankings.

## 🛠️ CLI Command Reference

Prefer the raw CLI? Everything is accessible via commands:

| Command | Description |
| :--- | :--- |
| `polaris deploy` | Provision a server with WireGuard or AmneziaWG |
| `polaris start` | Connect to VPN with Auto-DoH DNS Protection |
| `polaris start --fastest` | Benchmark saved profiles & auto-connect to lowest latency server |
| `polaris start --failover` | Connect with automatic multi-protocol fallback |
| `polaris stop` | Disconnect, stop DoH, and restore system DNS |
| `polaris benchmark` | Measure ICMP ping & TCP handshake latency across all saved profiles |
| `polaris bypass add <target>` | Add domain or IP subnet to split-tunneling bypass rules |
| `polaris bypass list` | View active split-tunneling bypass rules |
| `polaris import <file.conf>` | Import WireGuard/AmneziaWG `.conf` file (Mullvad, Proton, custom) |
| `polaris export <alias>` | Export profile config or display terminal QR code |
| `polaris dashboard` | Open the TUI Live Monitor directly |
| `polaris status --full` | Check connection state, GeoIP, and latency |
| `polaris peer add <name>` | Generate a new peer config for a friend/device |
| `polaris peer qr <name>` | Display the config as a QR code for mobile apps |
| `polaris check` | Run a 3-point privacy test (IP, DNS leak, IPv6 leak) |

*(All commands support the `--json` flag for machine-readable output or scripting)*

## ☁️ The Oracle Cloud Advantage

We highly recommend using the **Oracle Cloud Always Free Tier** to host your Polaris server:

- **ARM VM (A1.Flex)**: Up to 4 OCPUs and 24 GB RAM — completely free forever.
- **10 TB Bandwidth**: More than enough for high-speed streaming and gaming.
- No third-party VPN company logging your data or selling your traffic. You are in total command.

## 🔒 Trust Model

- **You own the server**: No reliance on third-party commercial VPN providers.
- **Zero telemetry**: No tracking, no crash reporting, no analytics.
- **Auto-DoH & Local Kill-Switch**: Traffic is strictly encrypted and locked to the VPN interface to prevent IP and DNS leaks.
- **Open Source**: Apache 2.0 licensed, fully auditable codebase.

---
*Built for developers who value privacy, speed, and beautiful terminal tools.*
