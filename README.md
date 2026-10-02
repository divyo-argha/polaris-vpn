<h1 align="center">Polaris VPN</h1>

<p align="center">
  <b>A self-hosted VPN CLI & terminal dashboard. Fast WireGuard & stealth tunnels on any VPS.</b>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/polaris-vpn"><img src="https://img.shields.io/npm/v/polaris-vpn?style=flat-square&color=88c0d0" alt="NPM Version" /></a>
  <a href="https://www.npmjs.com/package/polaris-vpn"><img src="https://img.shields.io/npm/dt/polaris-vpn?style=flat-square&color=a3be8c" alt="Downloads" /></a>
  <a href="https://github.com/Divyo/polaris-vpn/blob/main/LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-5e81ac?style=flat-square" alt="License" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen?style=flat-square" alt="Node Version" />
</p>

---

Commercial VPNs charge $5–15 a month, share the same IPs among thousands of people (meaning constant Cloudflare CAPTCHAs and streaming blocks), and ask you to take their "zero-log" marketing on faith.

**Polaris** gives you your own private VPN. It takes a fresh Linux server—on Oracle Cloud, AWS, DigitalOcean, Hetzner, or a home box—and configures everything for you in under a minute: WireGuard kernel modules, BBR congestion control, stealth handshake obfuscation (AmneziaWG), Unbound zero-log DNS, and ad-blocking.

You get a clean, dedicated IP, paid-grade speed, and total ownership over your traffic.

---

## What It Does

- **One-command deployment**: Provisions any clean Ubuntu, Debian, Oracle Linux, Rocky, or Fedora VPS over SSH in ~60 seconds.
- **DPI-resistant (AmneziaWG)**: Randomizes packet headers and sizes to glide right through strict firewalls and deep-packet inspection (DPI) that block vanilla WireGuard.
- **WireGuard + BBR**: Enables Google's BBR congestion control, PMTU MSS clamping, and tuned socket buffers on the server for maximum download throughput.
- **Zero-log DNS + AdBlock**: Automatically sets up Unbound on the server (`10.0.0.1`) so DNS lookups never touch Google or Cloudflare. Includes built-in tracker and ad domain blocking.
- **Full IPv6 & kill-switch**: Dual-stack IPv6 routing with firewall kill-switch rules (`pf` on macOS, `iptables` on Linux) to prevent leaks if the tunnel drops.
- **Watchdog auto-heal**: Background gateway heartbeat monitor that catches packet loss and quietly restarts the tunnel before you notice.
- **Terminal UI & QR codes**: Keyboard-driven TUI dashboard, built-in speedtest benchmark, and instant vector QR codes for iPhone and Android.

---

## Quick Install

Requires **Node.js 20 or higher** on your local machine:

```bash
npm install -g polaris-vpn
```

Run the built-in diagnostic wizard to check your environment:

```bash
polaris setup
```

---

## 3-Minute Setup

### 1. Grab a server
If you don't already have a VPS, Oracle Cloud offers 4 ARM cores, 24 GB RAM, and 10 TB/month of egress bandwidth completely free forever.

👉 **[Step-by-step Oracle Free Tier Guide](./docs/ORACLE_CLOUD.md)**

*(Any other cloud provider like AWS Lightsail, DigitalOcean $4 droplet, or Hetzner works just as well).*

### 2. Deploy your VPN
Point Polaris to your fresh server:

```bash
polaris deploy -s ubuntu@1.2.3.4
```

Want stealth mode to bypass restrictive school, office, or country firewalls? Pass `--mode amneziawg`:

```bash
polaris deploy -s ubuntu@1.2.3.4 -m amneziawg
```

Polaris handles SSH authentication, installs packages, sets up sysctl performance tweaks, generates cryptographic keys, and writes your local client config.

### 3. Connect

```bash
polaris start
```

Or just type `polaris` to open the full interactive terminal dashboard:

```bash
polaris
```

---

## Terminal Dashboard (TUI)

Typing `polaris` with no arguments launches the terminal dashboard:

```
  POLARIS — Leave no trace.
  Your True North in Digital Privacy.

  ┌──── DISCONNECTED ────┐┌── ◆ HOME ──────────────────────────────────┐
  │  ○ [DISCONNECTED]    ││                                            │
  │  No active tunnel    ││  ◆ Welcome to Polaris VPN                  │
  │                      ││  ────────────────────────────────────────  │
  │  ◆ Home              ││                                            │
  │  ⚙ Servers           ││    ○ No active tunnel running.             │
  │  ▶ Quick Connect     ││                                            │
  │  ⚡ Speed Test        ││    Saved Profiles:                         │
  │  ◉ Live Monitor      ││    1. oracle-fra   ubuntu@1.2.3.4  [fast]  │
  │  ──────────────────  ││                                            │
  │  ≡ Peers             ││    Press [Enter] on Quick Connect to run.  │
  │  ✦ Privacy Check     ││    Press [4] to run a live speedtest.      │
  │  ♥ Watchdog          ││                                            │
  │  ⊕ Deploy VPS        ││                                            │
  │  ──────────────────  ││                                            │
  │  ■ Disconnect        ││                                            │
  └──────────────────────┘└────────────────────────────────────────────┘
   [Tab / ↑↓] Navigate   [Enter] Select   [?] Help   [q] Quit
```

### Keyboard Shortcuts
- `1` – `9`: Instant jump to any tab (Home, Servers, Quick Connect, Speedtest, Monitor, Peers, Check, Watchdog, Deploy)
- `Tab` / `Shift+Tab` or `↑` / `↓`: Move selection
- `Enter`: Select / Connect
- `?`: Toggle help screen
- `q`: Quit

---

## Daily Usage

### Connection Management
```bash
# Connect to your default server
polaris start

# Connect to the lowest-latency server in your list
polaris start --fastest

# Disconnect cleanly and restore your original network DNS
polaris stop

# Check current connection, IP address, and transfer stats
polaris status --full
```

### Server Profiles
```bash
# Save a server profile
polaris add my-vps -s ubuntu@1.2.3.4 -t work

# List saved servers
polaris list

# Switch your active default server
polaris use my-vps

# Measure ping and latency across all your servers
polaris benchmark

# Delete a server profile
polaris rm my-vps
```

### Mobile Devices & Multi-Device
Want WireGuard on your iPhone, iPad, or Android phone?

```bash
# Create a new peer config for your phone
polaris peer add my-phone

# Render a vector QR code in your terminal
polaris peer qr my-phone
```

Open the WireGuard (or AmneziaWG) app on your phone, tap **+** → **Scan QR Code**, and you're done.

### Speed Test & Health Checks
```bash
# Benchmark actual download throughput and ping through the VPN
polaris speedtest

# Test for IP, DNS, IPv6, and WebRTC leaks
polaris check

# Run a one-time watchdog heartbeat test to verify gateway ping
polaris watchdog check
```

### Split Tunneling (Bypass Rules)
Need local LAN devices or specific sites to bypass the VPN tunnel?

```bash
polaris bypass add 192.168.1.0/24
polaris bypass add netflix.com
polaris bypass list
```

---

## Shell Tab-Completion

Polaris supports native tab-completion for **bash**, **zsh**, and **fish**. It autocompletes subcommands, flags, and even your saved server aliases (`polaris use <Tab>`):

```bash
# Zsh (add to ~/.zshrc)
eval "$(polaris completion zsh)"

# Bash (add to ~/.bashrc)
eval "$(polaris completion bash)"

# Fish (run once)
polaris completion fish | source
```

---

## Architecture & Security

- **Zero Logs**: The installer sets up Unbound directly on the VPS with `verbosity: 0` and disabled query logging. Your DNS lookups resolve directly against root servers rather than logging aggregators.
- **Built-in Ad-blocking**: A curated DNS sinkhole config (`adblock.conf`) runs directly inside Unbound on the server, killing tracking domains and ads at the resolver level before they hit your browser.
- **Cloud Firewall Ingress**: On cloud providers like Oracle Cloud that include strict host-level rejection chains, Polaris inserts its iptables rules at rule index 1 (`iptables -I INPUT 1 ...`) so WireGuard traffic is accepted cleanly without fighting host firewall templates.
- **Multi-Port Redirection**: On the VPS, UDP port 53 and 443 redirect internally to WireGuard port 51820. If a public Wi-Fi or hotel network blocks non-standard UDP ports, you can connect over ports that networks always leave open.
- **Accessibility & NO_COLOR**: Respects `process.env.NO_COLOR` per the `no-color.org` standard, using dual text+symbol cues (`[CONNECTED] (✓)`) for full usability with screen readers and color-blind profiles.

---

## License

Apache 2.0. Do whatever you like with it—run it, fork it, improve it.
