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

You should see a success message. All your internet traffic is now encrypted and routed through your VPS!

To verify everything is working and your IP has changed, run:

```bash
polaris check
```

## 5. Enable the Kill Switch (Optional)

To ensure your real IP is never leaked if the VPN connection drops, enable the system kill switch:

```bash
polaris killswitch on
```

## 6. Connect Mobile Devices

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

## 7. Stop the Tunnel

When you are done, simply run:

```bash
polaris stop
```
