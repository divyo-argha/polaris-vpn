<h1 align="center">Polaris VPN</h1>

<p align="center">
  <b>Command Your Digital Privacy. A Production-Grade Self-Hosted VPN CLI & Terminal UI.</b>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/polaris-vpn"><img src="https://img.shields.io/npm/v/polaris-vpn?style=for-the-badge&logo=npm&logoColor=white&color=88c0d0" alt="NPM Version" /></a>
  <a href="https://www.npmjs.com/package/polaris-vpn"><img src="https://img.shields.io/npm/dt/polaris-vpn?style=for-the-badge&logo=npm&logoColor=white&color=a3be8c" alt="Total Downloads" /></a>
  <a href="https://www.npmjs.com/package/polaris-vpn"><img src="https://img.shields.io/npm/dm/polaris-vpn?style=for-the-badge&logo=npm&logoColor=white&color=ebcb8b" alt="Monthly Downloads" /></a>
  <a href="https://github.com/Divyo/polaris-vpn"><img src="https://img.shields.io/github/stars/Divyo/polaris-vpn?style=for-the-badge&logo=github&logoColor=white&color=bf616a" alt="GitHub Stars" /></a>
  <a href="https://github.com/Divyo/polaris-vpn/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-Apache%202.0-5e81ac?style=for-the-badge&logo=apache&logoColor=white" alt="License" /></a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Security_Audit-0_Vulnerabilities-a3be8c?style=for-the-badge&logo=shieldsdotio&logoColor=white" alt="Security Audit" />
  <img src="https://img.shields.io/badge/Node.js-%3E%3D_18.0.0-339933?style=for-the-badge&logo=nodedotjs&logoColor=white" alt="Node Version" />
  <img src="https://img.shields.io/badge/Platforms-macOS_%7C_Linux_%7C_Windows-0078D6?style=for-the-badge&logo=apple&logoColor=white" alt="Platforms" />
</p>

<br />

Polaris VPN is a self-hosted VPN manager and Terminal User Interface (TUI) engineered for developers, privacy enthusiasts, and sysadmins. Provision an enterprise-grade WireGuard or Stealth AmneziaWG VPN server on any fresh Linux cloud server in under 60 seconds.

---

## Technical Performance & Metrics

<p align="center">
  <img src="https://img.shields.io/badge/Provisioning_Speed-%3C_60_Seconds-88c0d0?style=flat-square&logo=fastly&logoColor=white" alt="Deploy Time" />
  <img src="https://img.shields.io/badge/Protocols-WireGuard_%7C_AmneziaWG_%7C_TLS_%7C_SSH-b48ead?style=flat-square&logo=wireguard&logoColor=white" alt="Protocols" />
  <img src="https://img.shields.io/badge/DNS_Leak_Protection-Auto--DoH_127.0.0.1%3A5354-a3be8c?style=flat-square&logo=cloudflare&logoColor=white" alt="DNS Protection" />
  <img src="https://img.shields.io/badge/Telemetry-0_Logs_%7C_0_Tracking-bf616a?style=flat-square&logo=gnupg&logoColor=white" alt="Zero Telemetry" />
  <img src="https://img.shields.io/badge/Infrastructure-Oracle_Always_Free_Tier-ebcb8b?style=flat-square&logo=oracle&logoColor=white" alt="Infrastructure" />
</p>

| Performance Metric | Benchmark Standard | Polaris Architecture Implementation |
| :--- | :--- | :--- |
| **Server Setup Time** | `< 60 Seconds` | Automated automated Ansible-free shell orchestration |
| **DNS Leak Rating** | `0% Leak Ratio` | Local DNS-over-HTTPS (DoH) resolver bound to `127.0.0.1:5354` |
| **Protocol Redundancy** | `4 Tier Fallback` | Automatic protocol failover: `WireGuard` -> `AmneziaWG` -> `TLS` -> `SSH` |
| **Security Surface** | `0 Vulnerabilities` | Clean security audit, dependency graph lockdown, no native exploits |
| **Split Tunneling** | `Sub-millisecond` | Kernel-level routing & domain bypass rules via `polaris bypass` |
| **Mobile Access** | `Instant Sync` | Terminal-rendered vector QR codes via `polaris peer qr` |

---

## Core Capabilities

### Automated VPS Provisioning
Deploy an isolated VPN node on Ubuntu, Debian, or Fedora Linux servers with a single command. Handles WireGuard kernel modules, iptables firewall, and Unbound zero-log DNS configuration automatically.

### Live Terminal Dashboard (TUI)
Full-screen interactive terminal interface built with keyboard navigation (`Nord` design system). Provides live Rx/Tx bandwidth graphs, latency benchmarks, and active peer management.

### Auto-DoH & DNS Leak Safeguard
Binds system DNS on macOS and Linux to a local DoH resolver (`127.0.0.1:5354`) upon tunnel activation. Ensures DNS requests never leak to local ISPs and automatically backs up/restores original system resolver configurations upon teardown.

### Deep Packet Inspection (DPI) Stealth Mode
Integrates AmneziaWG obfuscation parameters (`Jc`, `Jmin`, `Jmax`, `S1`, `S2`, `H1`-`H4`) to randomize packet headers and payload sizes, enabling operation across restricted networks and DPI firewalls.

### Server Latency Benchmark & Auto-Selection
Measure ICMP ping and TCP handshake response times across saved profiles. The `--fastest` flag benchmarks endpoints and connects to the lowest-latency node automatically.

---

## Installation

Install globally via npm (Node.js 18.0.0 or higher required):

```bash
npm install -g polaris-vpn
```

Verify installation:

```bash
polaris --version
```

---

## Quick Start Guide

### 1. Provision a Server
Deploy WireGuard or Stealth AmneziaWG on a fresh cloud instance:

```bash
polaris deploy --server root@1.2.3.4 --mode amneziawg
```

### 2. Connect to Your Server
Connect with automatic DNS leak protection and DoH resolver initialization:

```bash
polaris start --server root@1.2.3.4
```

### 3. Save & Auto-Select Lowest Latency Node
Save server profiles for instant zero-arg connection or lowest-latency routing:

```bash
polaris add my-server --server root@1.2.3.4
polaris start --fastest
```

---

## Master Terminal Dashboard

Launch the interactive Terminal User Interface:

```bash
polaris
```

<pre>
+-----------------------------------------------------------------------------+
|  POLARIS VPN  v1.2.3                       Command your digital privacy.    |
+--------------------------+--------------------------------------------------+
| (o) Home                 | (o) Tunnel Status    [*] ACTIVE                  |
| (s) Servers              | ------------------------------------------------ |
| (>) Quick Connect        | Server   ubuntu@1.2.3.4                           |
| (m) Live Monitor         | Mode     AMNEZIAWG                               |
| -----------------------  | Latency  24 ms                                   |
| (p) Peers                | Data v   142.5 MB                                |
| (c) Privacy Check        | Data ^   18.2 MB                                 |
| (d) Deploy VPS           | ------------------------------------------------ |
| -----------------------  | [^/v] Navigate  [Enter] Select  [Esc/h] Home     |
+--------------------------+--------------------------------------------------+
</pre>

### Navigation Shortcuts

| Key Binding | Action |
| :--- | :--- |
| `↑ / ↓` or `k / j` | Navigate sidebar items and server lists |
| `Enter` | Activate highlighted menu item or confirm connection |
| `Esc` or `h` or `m` | Return to Main Menu / Home from any view or error screen |
| `b` | Launch live server latency benchmark rankings |
| `r` | Refresh WireGuard peer data |
| `1 - 7` | Direct numerical jump to main views |
| `q` or `Ctrl+C` | Quit Polaris VPN |

---

## Complete Command Matrix

| Command | Category | Functional Description |
| :--- | :--- | :--- |
| `polaris deploy` | Server | Provision Linux VPS with WireGuard/AmneziaWG in under 60 seconds |
| `polaris start` | Connection | Establish VPN tunnel with Auto-DoH DNS leak protection |
| `polaris start --fastest` | Connection | Benchmark saved endpoints and connect to lowest latency node |
| `polaris start --failover` | Connection | Connect with automatic multi-protocol fallback |
| `polaris stop` | Connection | Disconnect tunnel and restore original system DNS settings |
| `polaris benchmark` | Diagnostics | Rank saved server profiles by ping and TCP handshake speed |
| `polaris bypass add <target>` | Network | Add domain or IP subnet to split-tunneling bypass rules |
| `polaris bypass list` | Network | Display active split-tunneling bypass rules |
| `polaris import <file.conf>` | Profile | Import WireGuard or AmneziaWG `.conf` file |
| `polaris export <alias>` | Profile | Export profile config or display terminal QR code |
| `polaris dashboard` | Interface | Launch interactive Live Monitor TUI |
| `polaris status --full` | Status | Output connection state, GeoIP location, and rx/tx transfer |
| `polaris peer add <name>` | Access | Provision new peer config for additional devices |
| `polaris peer qr <name>` | Access | Render vector QR code in terminal for mobile setup |
| `polaris check` | Privacy | Run 3-point privacy audit (IP, DNS leak, IPv6 exposure) |

*(All commands support the `--json` flag for integration scripts and CI/CD pipelines)*

---

## Infrastructure: Oracle Cloud Always Free Tier

Polaris VPN is optimized for the **Oracle Cloud Always Free Tier**:

<p align="center">
  <img src="https://img.shields.io/badge/Instance-Ampere_A1_Compute-000000?style=flat-square&logo=oracle&logoColor=white" />
  <img src="https://img.shields.io/badge/Resources-4_OCPU_%7C_24_GB_RAM-88c0d0?style=flat-square&logo=cpu&logoColor=white" />
  <img src="https://img.shields.io/badge/Bandwidth-10_TB_/_Month-a3be8c?style=flat-square&logo=datacamp&logoColor=white" />
</p>

- **Zero Cost**: 4 OCPUs and 24 GB RAM free forever.
- **High Throughput**: 10 TB outbound data transfer per month.
- **Total Ownership**: No commercial VPN providers logging or monetizing your traffic.

---

## Trust Architecture & Security Posture

- **Zero Telemetry**: No tracking, no crash reports, no central authentication servers.
- **Local Key Generation**: Cryptographic key pairs generated locally via OS entropy source.
- **Native OS Kill-Switch**: Binds firewall rules (`pf` on macOS, `iptables` on Linux) to block unencrypted leak vectors.
- **Audit Verification**: Clean dependency graph with zero vulnerability alerts (`npm audit` verified).
- **Open Source**: Licensed under Apache 2.0.

---

<p align="center">
  <i>Engineered for total digital sovereignty.</i>
</p>
