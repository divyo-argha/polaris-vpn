# Step-by-Step Setup Guide

This guide walks you through setting up Polaris VPN from scratch. By the end, you'll have your own high-speed WireGuard (or stealth AmneziaWG) VPN running on a private server with ad-blocking and zero DNS leaks.

---

## Prerequisites

Before starting, you only need two things:

1. **A Linux server (VPS)**: Any clean instance of Ubuntu (22.04 or 24.04), Debian (11 or 12), Oracle Linux (8 or 9), Rocky Linux, or Fedora. If you don't have one, Oracle Cloud gives you one [free forever](./ORACLE_CLOUD.md).
2. **Node.js 18 or newer** installed on your laptop/computer.

---

## 1. Install Polaris CLI

On your laptop or desktop (where you'll be connecting from), install the CLI:

```bash
npm install -g polaris-vpn
```

Check that it's installed and verify your local system dependencies:

```bash
polaris setup
```

The setup command will check if you have `wireguard-tools` (`wg-quick`) installed locally. If you're missing them, it will tell you the exact command to run:
- **macOS**: `brew install wireguard-tools`
- **Ubuntu/Debian**: `sudo apt install wireguard-tools`
- **Arch**: `sudo pacman -S wireguard-tools`

---

## 2. Deploy Your Server

Once your cloud VPS is running and you have its public IP and SSH access:

### Option A: Standard WireGuard (Fastest, default)
Best for general use, gaming, streaming, and everyday browsing with BBR acceleration:

```bash
polaris deploy -s ubuntu@YOUR_SERVER_IP
```

### Option B: Stealth Mode (AmneziaWG)
Recommended if you're on a restrictive network (work, university, hotel, or country firewalls) that detects and blocks standard WireGuard handshakes:

```bash
polaris deploy -s ubuntu@YOUR_SERVER_IP -m amneziawg
```

### Handling SSH Keys
- Polaris automatically tries your default `~/.ssh/id_rsa` or `~/.ssh/id_ed25519`.
- If you downloaded a specific key from your cloud provider (like Oracle Cloud):
  ```bash
  polaris deploy -s ubuntu@YOUR_SERVER_IP -i /path/to/private-key.key
  ```
- Or pass an SSH password if your VPS uses password auth:
  ```bash
  polaris deploy -s root@YOUR_SERVER_IP -p "your_password"
  ```

Deployment takes about 60 to 90 seconds. It automatically installs WireGuard kernel modules, configures BBR congestion control, sets up local Unbound zero-log DNS, activates ad-blocking, clamps MSS to prevent packet fragmentation, and downloads your ready-to-use client config.

---

## 3. Save as a Profile

Give your server a friendly alias so you never have to remember its IP again:

```bash
polaris add my-vps -s ubuntu@YOUR_SERVER_IP -t home
```

---

## 4. Connect to the VPN

To connect from the command line:

```bash
polaris start
```

Or open the interactive dashboard:

```bash
polaris
```

Hit **Enter** on **Quick Connect** to start the tunnel.

---

## 5. Verify Your Connection

Once connected, run a quick leak check:

```bash
polaris check
```

This tests:
1. **Public IP**: Confirms your outbound IP matches your VPS instead of your home ISP.
2. **DNS Leak Test**: Confirms queries resolve through your in-tunnel Unbound resolver (`10.0.0.1`) rather than your local network provider.
3. **IPv6 Leak Test**: Ensures IPv6 traffic routes through the encrypted tunnel (`fd00:polaris::`) without leaking outside.
4. **WebRTC Protection**: Checks for browser-level IP disclosure.

You can also run a live throughput benchmark:

```bash
polaris speedtest
```

---

## 6. Add Your Phone or Tablet

Polaris can generate peer configs and display QR codes directly in your terminal:

```bash
# 1. Generate the peer on your VPS
polaris peer add iphone

# 2. Render a QR code in the terminal
polaris peer qr iphone
```

1. Install the **WireGuard** app (or **AmneziaWG** app if using stealth mode) from the iOS App Store or Google Play.
2. Tap **+** → **Scan from QR Code**.
3. Name it (e.g. `polaris`) and toggle it on. Your phone is now routed through your private server.

---

## 7. Split Tunneling (Bypass Rules)

If you have local devices (like a home NAS or printer) or specific websites you want to access directly outside the VPN:

```bash
# Bypass local network
polaris bypass add 192.168.1.0/24

# Bypass a specific domain
polaris bypass add netflix.com

# List current rules
polaris bypass list

# Remove a rule
polaris bypass remove netflix.com
```

---

## 8. Disconnecting

To stop the tunnel and revert your network settings back to default:

```bash
polaris stop
```

Polaris automatically restores your original DNS resolvers, turns off proxy settings, cleans up temporary routing rules, and closes the tunnel cleanly.

---

## Common Gotchas & Troubleshooting

- **Connection times out / WireGuard doesn't respond**: Check your cloud provider's firewall or security list (e.g., Oracle VCN Security Lists, AWS Security Groups). UDP port `51820` must be allowed for ingress traffic.
- **Port already in use**: If another process is using port 1080 (for SSH/SOCKS mode), run `polaris stop` or pass a different port with `polaris start -p 1085`.
- **Root permissions**: Managing network interfaces requires `sudo` privileges. Make sure your user can run `sudo wg-quick`.
- **Updating server packages**: To keep your VPS updated with the latest security patches for WireGuard, Unbound, and Fail2Ban:
  ```bash
  polaris update-server
  ```
