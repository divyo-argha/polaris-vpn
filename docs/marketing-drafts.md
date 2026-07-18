# Marketing Drafts for Polaris VPN

Use these templates to post to various communities to drive your npm downloads.

---

## 1. Hacker News (Show HN)
**Title:** Show HN: I built a free, self-hosted stealth VPN CLI for Oracle Cloud
**Link / Text:**

I got tired of paying for commercial VPNs that harvest data, so I built Polaris. It’s an open-source CLI tool that automatically provisions a WireGuard or AmneziaWG (Stealth Mode) VPN on any Linux VPS in about 30 seconds.

I optimized it specifically for Oracle Cloud's "Always Free" ARM tier (2 OCPUs, 12GB RAM, 10TB bandwidth), so you can effectively get a high-performance personal VPN completely for free, forever. 

Features:
- Native WireGuard & Stealth Mode (AmneziaWG for DPI bypass)
- Zero-Log Self-Hosted DNS (Unbound is automatically configured on the server)
- SOCKS5 / SSH tunnel fallback modes
- Built-in live bandwidth monitoring & terminal TUI dashboard
- System-wide Kill Switch 
- Terminal QR codes for mobile setup

Would love for you to try it out and tear the code apart. 

Repo: https://github.com/Divyo/polaris-vpn
`npm install -g polaris-vpn`

---

## 2. Reddit (r/selfhosted, r/privacy, r/homelab)
**Title:** I built a CLI tool to automate deploying a free, zero-log stealth VPN on Oracle Cloud in 30 seconds

**Body:**
Hey r/selfhosted!

I’ve been working on a project called **Polaris VPN**. The goal was to make spinning up a secure, self-hosted VPN as easy as typing a single command, without having to manually mess with `iptables` routing, DNS leaks, or WireGuard configs.

It works perfectly with the Oracle Cloud Free Tier. If you have an empty Ubuntu VM sitting there, you can run:

`polaris deploy --server ubuntu@<your-ip>`

And it will automatically:
1. Install WireGuard (or AmneziaWG for stealth/DPI bypass)
2. Setup UFW and Fail2Ban for security
3. Install and configure **Unbound** so your DNS queries never hit Cloudflare or Google (Zero-Log DNS)
4. Configure your local machine to route all traffic through it.

It also has a cool terminal dashboard (`polaris dashboard`) to monitor your bandwidth and peers, and can generate QR codes in the terminal (`polaris peer qr mobile`) to instantly connect your phone.

It's completely open-source (Apache 2.0). 
Repo: https://github.com/Divyo/polaris-vpn

If anyone has an Oracle Cloud account or a spare VPS, I'd love to hear your feedback!

---

## 3. Dev.to / Medium Tutorial
**Title:** How to host your own Stealth VPN for free (and never pay for a VPN again)

**(Outline for your blog post):**
1. **The Problem:** Commercial VPNs are honeypots. They log your data, get blocked by Netflix/DPI, and cost $5-10/month.
2. **The Solution:** Oracle Cloud Always Free tier + Polaris VPN.
3. **Step 1:** Sign up for Oracle Cloud and launch an Ubuntu ARM VM.
4. **Step 2:** Run `npm install -g polaris-vpn`
5. **Step 3:** Run `polaris deploy --server ubuntu@your-ip`
6. **Step 4:** Run `polaris start --server ubuntu@your-ip`
7. **Explain the Tech:** Talk about AmneziaWG obfuscation, Unbound local DNS for privacy, and how it bypasses DPI (Deep Packet Inspection) which blocks normal WireGuard.
8. **Call to Action:** Ask them to star the repo and try it out!
