import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { generateKeyPair, generateAwgParams } from '../tunnel/wg.js';
import { ensureDir, CONFIG_DIR } from '../utils/config.js';

const getDefaultPrivateKey = () => {
  const keys = ['id_rsa', 'id_ed25519', 'id_ecdsa', 'id_dsa'];
  for (const k of keys) {
    const p = path.join(os.homedir(), '.ssh', k);
    if (fs.existsSync(p)) {
      return fs.readFileSync(p);
    }
  }
  return null;
};

const sshExec = (client, command) => {
  return new Promise((resolve, reject) => {
    client.exec(command, (err, stream) => {
      if (err) return reject(err);
      let stdout = '';
      let stderr = '';
      stream.on('close', (code) => {
        resolve({ code, stdout, stderr });
      }).on('data', (data) => {
        stdout += data.toString('utf8');
      }).stderr.on('data', (data) => {
        stderr += data.toString('utf8');
      });
    });
  });
};

export const deployServer = async (serverStr, options = {}) => {
  const parts = serverStr.split('@');
  const username = parts.length > 1 ? parts[0] : 'ubuntu';
  const host = parts.length > 1 ? parts[1] : parts[0];
  const isAwg = options.mode === 'amneziawg';
  
  let privateKey = null;
  if (options.privateKey) {
    if (!fs.existsSync(options.privateKey)) {
      throw new Error(`SSH private key file not found: ${options.privateKey}`);
    }
    privateKey = fs.readFileSync(options.privateKey);
  } else {
    privateKey = getDefaultPrivateKey();
  }

  if (!privateKey && !options.password) {
    throw new Error('No SSH authentication method found. Please configure default SSH keys or specify key path/password.');
  }

  // 1. Generate local keys
  const serverKeys = generateKeyPair();
  const clientKeys = generateKeyPair();
  const awgParams = isAwg ? generateAwgParams() : null;

  const conn = new Client();

  return new Promise((resolve, reject) => {
    conn.on('ready', async () => {
      try {
        const onProgress = options.onProgress || (() => {});
        const ifaceName = isAwg ? 'awg0' : 'wg0';
        const configDir = isAwg ? '/etc/amnezia/amneziawg' : '/etc/wireguard';
        const quickCmd = isAwg ? 'awg-quick' : 'wg-quick';

        // Step 1: Detect package manager and install packages
        onProgress(`Detecting OS and installing ${isAwg ? 'AmneziaWG' : 'WireGuard'}, Unbound, and security tools...`);
        const installScript = `
if command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update -y
  if [ "${isAwg}" = "true" ]; then
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y software-properties-common linux-headers-$(uname -r) || true
    sudo add-apt-repository -y ppa:amnezia/ppa || true
    sudo apt-get update -y
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y amneziawg-dkms amneziawg-tools iptables ufw unbound fail2ban || sudo DEBIAN_FRONTEND=noninteractive apt-get install -y wireguard wireguard-tools iptables ufw unbound fail2ban
  else
    sudo DEBIAN_FRONTEND=noninteractive apt-get install -y wireguard wireguard-tools iptables ufw unbound fail2ban
  fi
elif command -v dnf >/dev/null 2>&1; then
  sudo dnf install -y epel-release || true
  sudo dnf install -y wireguard-tools iptables iptables-services unbound fail2ban || sudo dnf install -y wireguard-tools unbound fail2ban
elif command -v yum >/dev/null 2>&1; then
  sudo yum install -y epel-release || true
  sudo yum install -y wireguard-tools iptables iptables-services unbound fail2ban || sudo yum install -y wireguard-tools unbound fail2ban
elif command -v pacman >/dev/null 2>&1; then
  sudo pacman -Sy --noconfirm wireguard-tools iptables unbound fail2ban
else
  echo "Unsupported package manager" >&2
  exit 1
fi
`;
        let res = await sshExec(conn, installScript);
        if (res.code !== 0) throw new Error(`Installation failed: ${res.stderr || res.stdout}`);

        // Step 2: Enable packet forwarding, BBR congestion control, and paid-grade kernel performance
        onProgress('Enabling BBR congestion control and kernel network optimizations...');
        const sysctlScript = `
sudo modprobe tcp_bbr 2>/dev/null || true
cat << 'EOF' | sudo tee /etc/sysctl.d/99-polaris.conf
net.ipv4.ip_forward=1
net.ipv4.ip_nonlocal_bind=1
net.core.default_qdisc=fq
net.ipv4.tcp_congestion_control=bbr
net.core.rmem_max=16777216
net.core.wmem_max=16777216
net.ipv4.tcp_rmem=4096 87380 16777216
net.ipv4.tcp_wmem=4096 65536 16777216
EOF
sudo sysctl -p /etc/sysctl.d/99-polaris.conf 2>/dev/null || sudo sysctl -w net.ipv4.ip_forward=1 net.ipv4.ip_nonlocal_bind=1
`;
        res = await sshExec(conn, sysctlScript);
        if (res.code !== 0) throw new Error(`Kernel network setup failed: ${res.stderr}`);

        // Step 3: Detect default interface
        onProgress('Detecting default interface...');
        res = await sshExec(conn, "ip route show default | awk '/default/ {print $5}'");
        const ethInterface = res.stdout.trim() || 'eth0';

        // Step 4: Write server config with MSS Clamping and robust firewall rules
        onProgress(`Configuring server ${ifaceName}...`);
        
        let obfuscationBlock = '';
        if (isAwg) {
          obfuscationBlock = `Jc = ${awgParams.Jc}
Jmin = ${awgParams.Jmin}
Jmax = ${awgParams.Jmax}
S1 = ${awgParams.S1}
S2 = ${awgParams.S2}
H1 = ${awgParams.H1}
H2 = ${awgParams.H2}
H3 = ${awgParams.H3}
H4 = ${awgParams.H4}`;
        }

        const serverConf = `[Interface]
PrivateKey = ${serverKeys.privateKey}
Address = 10.0.0.1/24
ListenPort = 51820
PostUp = iptables -I INPUT 1 -p udp --dport 51820 -j ACCEPT; iptables -I FORWARD 1 -i %i -j ACCEPT; iptables -I FORWARD 1 -o %i -m state --state RELATED,ESTABLISHED -j ACCEPT; iptables -t nat -A POSTROUTING -o ${ethInterface} -j MASQUERADE; iptables -t mangle -A FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu; (command -v ufw >/dev/null && ufw route allow in on ${ifaceName} 2>/dev/null || true)
PostDown = iptables -D INPUT -p udp --dport 51820 -j ACCEPT 2>/dev/null || true; iptables -D FORWARD -i %i -j ACCEPT 2>/dev/null || true; iptables -D FORWARD -o %i -m state --state RELATED,ESTABLISHED -j ACCEPT 2>/dev/null || true; iptables -t nat -D POSTROUTING -o ${ethInterface} -j MASQUERADE 2>/dev/null || true; iptables -t mangle -D FORWARD -p tcp --tcp-flags SYN,RST SYN -j TCPMSS --clamp-mss-to-pmtu 2>/dev/null || true; (command -v ufw >/dev/null && ufw route delete allow in on ${ifaceName} 2>/dev/null || true)
${obfuscationBlock}

[Peer]
PublicKey = ${clientKeys.publicKey}
AllowedIPs = 10.0.0.2/32
`;

        res = await sshExec(conn, `sudo mkdir -p ${configDir} && cat << 'EOF' > /tmp/${ifaceName}.conf\n${serverConf}\nEOF\nsudo mv /tmp/${ifaceName}.conf ${configDir}/${ifaceName}.conf && sudo chmod 600 ${configDir}/${ifaceName}.conf`);
        if (res.code !== 0) throw new Error(`Server config write failed: ${res.stderr}`);

        // Step 5: Start service
        onProgress(`Starting ${ifaceName} interface...`);
        res = await sshExec(conn, `sudo systemctl stop ${quickCmd}@${ifaceName} 2>/dev/null || true; sudo systemctl start ${quickCmd}@${ifaceName} && sudo systemctl enable ${quickCmd}@${ifaceName}`);
        if (res.code !== 0) throw new Error(`Starting tunnel failed: ${res.stderr}`);

        // Step 5b: Configure Unbound DNS
        onProgress('Configuring Unbound Zero-Log DNS...');
        const unboundConf = `server:
    interface: 10.0.0.1
    access-control: 10.0.0.0/24 allow
    hide-identity: yes
    hide-version: yes
    use-caps-for-id: yes
    prefetch: yes
`;
        res = await sshExec(conn, `cat << 'EOF' > /tmp/polaris-dns.conf\n${unboundConf}\nEOF\nsudo mkdir -p /etc/unbound/unbound.conf.d && sudo mv /tmp/polaris-dns.conf /etc/unbound/unbound.conf.d/polaris-dns.conf && sudo systemctl restart unbound 2>/dev/null || true; sudo systemctl enable unbound 2>/dev/null || true`);

        // Step 5c: Start Fail2Ban if available
        onProgress('Configuring Fail2Ban SSH protection...');
        await sshExec(conn, 'sudo systemctl enable fail2ban 2>/dev/null && sudo systemctl restart fail2ban 2>/dev/null || true');

        // Step 6: Configure Firewall (UFW or firewalld)
        onProgress('Configuring firewall rules...');
        await sshExec(conn, `
if command -v ufw >/dev/null 2>&1; then
  sudo ufw allow 51820/udp 2>/dev/null || true
  sudo ufw allow 22/tcp 2>/dev/null || true
  echo "y" | sudo ufw enable 2>/dev/null || true
elif command -v firewall-cmd >/dev/null 2>&1; then
  sudo firewall-cmd --add-port=51820/udp --permanent 2>/dev/null || true
  sudo firewall-cmd --add-service=ssh --permanent 2>/dev/null || true
  sudo firewall-cmd --add-masquerade --permanent 2>/dev/null || true
  sudo firewall-cmd --reload 2>/dev/null || true
fi
# Ensure iptables does not block UDP 51820 on Oracle Cloud
sudo iptables -I INPUT 1 -p udp --dport 51820 -j ACCEPT 2>/dev/null || true
`);

        // Step 7: Write client config locally
        onProgress('Saving local client configuration...');
        const clientConf = `[Interface]
PrivateKey = ${clientKeys.privateKey}
Address = 10.0.0.2/24
DNS = 10.0.0.1
MTU = 1420
${obfuscationBlock}

[Peer]
PublicKey = ${serverKeys.publicKey}
Endpoint = ${host}:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
`;

        const wgDir = path.join(CONFIG_DIR, 'wg');
        ensureDir(wgDir);
        
        // Save client config
        const clientConfPath = path.join(wgDir, `${ifaceName}.conf`);
        fs.writeFileSync(clientConfPath, clientConf, 'utf-8');

        // Also save provisioning info to config
        fs.writeFileSync(path.join(wgDir, 'deploy.json'), JSON.stringify({
          server: serverStr,
          mode: options.mode || 'wireguard',
          serverPublicKey: serverKeys.publicKey,
          clientPublicKey: clientKeys.publicKey,
          interface: ethInterface,
          awgParams: isAwg ? awgParams : null,
          identity: options.privateKey ? (typeof options.privateKey === 'string' ? options.privateKey : null) : null,
          port: options.port || 22,
          timestamp: new Date().toISOString()
        }, null, 2), 'utf-8');

        conn.end();
        resolve({ clientConfPath, clientPublicKey: clientKeys.publicKey, serverPublicKey: serverKeys.publicKey });
      } catch (err) {
        conn.end();
        reject(err);
      }
    }).on('error', (err) => {
      reject(err);
    });

    conn.connect({
      host,
      port: options.port || 22,
      username,
      privateKey,
      password: options.password,
      readyTimeout: 10000 // 10 second timeout for SSH connection
    });
  });
};
