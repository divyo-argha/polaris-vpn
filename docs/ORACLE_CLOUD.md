# Setting Up Oracle Cloud Always Free VPS

Oracle Cloud offers one of the best free tiers anywhere: up to **4 ARM cores, 24 GB of RAM, and 10 TB/month of outbound data** at zero cost. That makes it hands-down the best place to host your own personal WireGuard server.

Here is the straightforward guide to getting your free instance running and ready for Polaris in about 5 minutes.

---

## 1. Sign Up for Oracle Cloud Free Tier

1. Head over to [oracle.com/cloud/free](https://www.oracle.com/cloud/free/) and click **Start for free**.
2. Fill in your details. You'll need to provide a credit or debit card for identity verification. **You will not be billed**—it places a temporary $1 authorization hold that drops off.
3. **Pick your Home Region carefully**: Choose the data center geographically closest to you (e.g. Frankfurt, Singapore, Ashburn, Mumbai, London). Low geographic latency gives you the fastest VPN speeds. You cannot change your home region later without recreating the account.

---

## 2. Launch Your Compute Instance

Once you're in the Oracle Cloud Console:

1. From the main menu, go to **Compute** → **Instances**, then click **Create Instance**.
2. **Name**: Name it something simple like `polaris-vpn`.
3. **Placement**: Leave the default Availability Domain (e.g. `AD-1`).
4. **Image and Shape**: Click **Edit**:
   - **Image**: Select **Ubuntu 22.04 LTS** (or **Ubuntu 24.04** / **Oracle Linux 9**).
   - **Shape**: Click **Change Shape**, choose **Ampere (ARM-based Processor)**, and select `VM.Standard.A1.Flex`.
   - Allocate your resources: **2 OCPUs** and **12 GB RAM** is more than enough for a blistering-fast VPN (and leaves you quota to run another free VM later if you want).
5. **Networking**:
   - Keep the default Virtual Cloud Network (VCN) and subnet.
   - Make sure **Assign a public IPv4 address** is checked.
6. **SSH Keys**:
   - Select **Generate a key pair for me**.
   - Click **Save private key** to download your `.key` file. Save it somewhere you can find it (e.g., `~/.ssh/oracle-vpn.key`).
7. Click **Create** at the bottom. The instance will take about 1 to 2 minutes to show a green status (`RUNNING`).

---

## 3. Open the Firewall (Crucial Step)

By default, Oracle's cloud network blocks all incoming traffic except SSH (port 22). WireGuard needs **UDP port 51820** to receive tunnel handshakes.

1. On your instance details page, scroll down to the **Instance Access** or **Primary VNIC** section and click the link under **Subnet** (e.g., `Public Subnet-xxxx`).
2. Click **Default Security List for...**.
3. Under **Ingress Rules**, click **Add Ingress Rules**.
4. Enter the following:
   - **Source Type**: `CIDR`
   - **Source CIDR**: `0.0.0.0/0`
   - **IP Protocol**: `UDP`
   - **Destination Port Range**: `51820`
   - **Description**: `Allow WireGuard / AmneziaWG`
5. Click **Add Ingress Rules**.

*(Note: Polaris's deploy script also adds host-level iptables rules on the VPS itself, so you don't need to fiddle with `iptables` manually).*

---

## 4. Deploy Polaris

Now copy your server's **Public IP address** from the Oracle Console.

Open your local terminal and test your SSH connection:

```bash
# Make sure your key has correct permissions
chmod 600 ~/.ssh/oracle-vpn.key

# Deploy Polaris to your Oracle instance
polaris deploy -s ubuntu@<YOUR_PUBLIC_IP> -i ~/.ssh/oracle-vpn.key
```

If you want stealth mode enabled (AmneziaWG to bypass restrictive DPI firewalls):

```bash
polaris deploy -s ubuntu@<YOUR_PUBLIC_IP> -i ~/.ssh/oracle-vpn.key -m amneziawg
```

Polaris will configure the kernel modules, set up BBR acceleration, configure Unbound DNS + AdBlock, and save your client config.

Once done, connect with:

```bash
polaris start
```

That's it—you're running a private, dedicated, zero-log VPN on a 10 TB/month pipe for free.
