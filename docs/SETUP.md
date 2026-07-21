# Full Step-by-Step Setup Guide

Welcome to Polaris VPN! This guide will take you from scratch to having a fully functional, DPI-resistant self-hosted VPN.

## 1. Prepare a Virtual Private Server (VPS)

Polaris needs a Linux server (Ubuntu/Debian recommended) to host the VPN.
If you don't already have one, you can easily get a powerful one for **free forever**.

👉 **[Click here for the Oracle Cloud Free Tier Guide](./ORACLE_CLOUD.md)**

*Once you have your server's Public IP address and SSH Private Key, continue to Step 2.*

## 2. Install Polaris VPN

On your local machine (where you want to connect *from*), you need Node.js installed.

Install the Polaris CLI globally:

```bash
npm install -g polaris-vpn
```

## 3. Provision the Server

You will now use Polaris to automatically install and configure the VPN on your new VPS.

Run the `deploy` command. We highly recommend using the `amneziawg` mode to ensure your VPN traffic cannot be blocked by Deep Packet Inspection (DPI):

```bash
polaris deploy --server ubuntu@<YOUR_SERVER_IP> --mode amneziawg
```

*Note: If you receive an SSH authentication error, you need to provide your SSH private key. By default, Polaris looks for `~/.ssh/id_rsa`. If your key is saved elsewhere (like the one downloaded from Oracle), you can use it like this:*

```bash
eval "$(ssh-agent -s)"
ssh-add /path/to/your/oracle-ssh-key.key
polaris deploy --server ubuntu@<YOUR_SERVER_IP> --mode amneziawg
```

This process takes about 2-3 minutes. Polaris will install AmneziaWG, configure the stealth parameters, set up the kernel modules, and generate your local client configuration.

## 4. Start the Tunnel

Once deployment is successful, you can connect to your new VPN!

Run:

```bash
polaris start
```

*Note: By default, `polaris start` automatically launches local DNS-over-HTTPS (`127.0.0.1:5354`) and binds system DNS to prevent ISP DNS leaks.*

To automatically measure server ping latency and connect to the fastest available profile:

```bash
polaris start --fastest
```

To verify everything is working and your IP has changed, run:

```bash
polaris check
```

## 5. Enable Split Tunneling / Bypass Rules (Optional)

Want local LAN devices or specific streaming sites to bypass the VPN?

```bash
# Add domain or IP subnet to bypass rules
polaris bypass add netflix.com
polaris bypass add 192.168.1.0/24

# View active bypass rules
polaris bypass list
```

## 6. Measure Server Latency (`polaris benchmark`)

If you have multiple saved profiles, rank them by ICMP ping and TCP handshake latency:

```bash
polaris benchmark
```

## 7. Import & Export Configuration Files

Import third-party WireGuard / AmneziaWG `.conf` files (from providers like Mullvad, ProtonVPN, or custom servers):

```bash
polaris import ~/Downloads/mullvad-us.conf --alias mullvad-us
```

Export any saved profile to a `.conf` file or display a terminal QR code:

```bash
polaris export mullvad-us --out ./mullvad-us.conf
```

## 8. Connect Mobile Devices

Want to use the VPN on your phone? Polaris can generate terminal QR codes!
First, generate a new peer configuration on the server:

```bash
polaris peer add my-iphone
```

Then, display the QR code on your terminal:

```bash
polaris peer qr my-iphone
```

Download the **AmneziaWG** app on iOS or Android, tap the `+` button, select **Create from QR code**, and scan your screen!

## 9. Stop the Tunnel

When you are done, simply run:

```bash
polaris stop
```

*(This automatically stops the tunnel, turns off Auto-DoH, and restores your original system DNS settings)*
