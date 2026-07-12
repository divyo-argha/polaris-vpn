# Oracle Cloud "Always Free" VPS Guide

Oracle Cloud offers the most generous free tier in the cloud computing market, making it the perfect companion for a self-hosted Polaris VPN.

This guide will walk you through exactly how to set up an Oracle ARM instance, configure the firewall, and prepare it for Polaris.

## 1. Sign Up for Oracle Cloud

1. Go to [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/) and sign up.
2. You will need to provide a credit/debit card for verification. **You will not be charged.** Oracle requires this to prevent spam.
3. Select your **Home Region** carefully. You cannot change this later without deleting your account. Pick the region geographically closest to you for the lowest latency.
   - *Example: If you are in South Asia, pick Mumbai or Hyderabad. If you are in Southeast Asia, pick Singapore.*

## 2. Create the Compute Instance

1. From the Oracle Cloud Dashboard, click **Create a VM instance**.
2. **Name**: `polaris-vpn` (or whatever you prefer).
3. **Placement**: Leave as default (AD-1).
4. **Image and Shape**:
   - Click **Edit**.
   - **Image**: Select **Ubuntu** (Recommend version 22.04 or newer).
   - **Shape**: Select **Ampere (ARM)** (`VM.Standard.A1.Flex`).
   - Configure the shape to use **2 OCPUs** and **12 GB RAM**. (You are allowed up to 4 OCPUs and 24 GB RAM for free, but 2 OCPUs is more than enough for a VPN).
5. **Networking**:
   - Leave the default VCN settings.
   - Ensure **Assign a public IPv4 address** is checked.
6. **Add SSH keys**:
   - Select **Generate a key pair for me**.
   - Click **Save private key**. Keep this `.key` file safe! You will need it to connect.
7. Click **Create** at the bottom of the page. Your instance will take about 2-3 minutes to provision.

## 3. Configure the Virtual Cloud Network (VCN) Firewall

By default, Oracle Cloud blocks all incoming traffic except SSH (Port 22). WireGuard (and AmneziaWG) requires UDP port 51820 to be open.

1. On your instance details page, look for the **Primary VNIC** section and click on the **Subnet** link (e.g., `subnet-xxxx`).
2. Under **Security Lists**, click the Default Security List.
3. Click **Add Ingress Rules**.
4. Configure the rule as follows:
   - **Source Type**: CIDR
   - **Source CIDR**: `0.0.0.0/0`
   - **IP Protocol**: UDP
   - **Destination Port Range**: `51820`
   - **Description**: Allow WireGuard/AmneziaWG
5. Click **Add Ingress Rules**.

*(Note: If you plan to use the SSH SOCKS5 proxy instead of WireGuard, you don't need to open port 51820, as SSH uses port 22 which is already open).*

## 4. Get Ready for Polaris

1. Go back to your **Instance Details** page.
2. Note down the **Public IP Address** (e.g., `123.45.67.89`).
3. Note the default username for Ubuntu images is always `ubuntu`.
4. Locate the private key you downloaded in Step 2.6 (e.g., `ssh-key-2026-07-12.key`).

You are now ready to deploy Polaris! Head back to the [Full Setup Guide](./SETUP.md) and run the `polaris deploy` command with your new Oracle IP and SSH key.
