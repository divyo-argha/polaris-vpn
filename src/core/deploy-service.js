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
  
  const privateKey = options.privateKey 
    ? fs.readFileSync(options.privateKey) 
    : getDefaultPrivateKey();

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

        // Step 1: Install packages
        onProgress(`Installing ${isAwg ? 'AmneziaWG' : 'WireGuard'} and UFW on remote VPS...`);
        let installCmd = 'sudo apt-get update -y && sudo apt-get install -y wireguard ufw';
        if (isAwg) {
          installCmd = 'sudo apt-get update -y && sudo apt-get install -y software-properties-common && sudo add-apt-repository -y ppa:amnezia/ppa && sudo apt-get update -y && sudo apt-get install -y amneziawg-dkms amneziawg-tools ufw';
        }
        let res = await sshExec(conn, installCmd);
        if (res.code !== 0) throw new Error(`Installation failed: ${res.stderr}`);

        // Step 2: Enable packet forwarding
        onProgress('Enabling IPv4 forwarding...');
        res = await sshExec(conn, 'sudo sysctl -w net.ipv4.ip_forward=1 && echo "net.ipv4.ip_forward=1" | sudo tee -a /etc/sysctl.conf');
        if (res.code !== 0) throw new Error(`IPv4 forwarding setup failed: ${res.stderr}`);

        // Step 3: Detect default interface
        onProgress('Detecting default interface...');
        res = await sshExec(conn, "ip route show default | awk '/default/ {print $5}'");
        const ethInterface = res.stdout.trim() || 'eth0';

        // Step 4: Write server config
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
PostUp = ufw route allow in on ${ifaceName}; iptables -t nat -A POSTROUTING -o ${ethInterface} -j MASQUERADE
PostDown = ufw route delete allow in on ${ifaceName}; iptables -t nat -D POSTROUTING -o ${ethInterface} -j MASQUERADE
${obfuscationBlock}

[Peer]
PublicKey = ${clientKeys.publicKey}
AllowedIPs = 10.0.0.2/32
`;

        res = await sshExec(conn, `sudo mkdir -p ${configDir} && cat << 'EOF' > /tmp/${ifaceName}.conf\n${serverConf}\nEOF\nsudo mv /tmp/${ifaceName}.conf ${configDir}/${ifaceName}.conf && sudo chmod 600 ${configDir}/${ifaceName}.conf`);
        if (res.code !== 0) throw new Error(`Server config write failed: ${res.stderr}`);

        // Step 5: Start service
        onProgress(`Starting ${ifaceName} interface...`);
        res = await sshExec(conn, `sudo systemctl stop ${quickCmd}@${ifaceName} || true && sudo systemctl start ${quickCmd}@${ifaceName} && sudo systemctl enable ${quickCmd}@${ifaceName}`);
        if (res.code !== 0) throw new Error(`Starting tunnel failed: ${res.stderr}`);

        // Step 6: Configure UFW firewall
        onProgress('Configuring UFW firewall...');
        res = await sshExec(conn, 'sudo ufw allow 51820/udp && sudo ufw allow 22/tcp && echo "y" | sudo ufw enable');
        if (res.code !== 0) throw new Error(`Firewall setup failed: ${res.stderr}`);

        // Step 7: Write client config locally
        onProgress('Saving local client configuration...');
        const clientConf = `[Interface]
PrivateKey = ${clientKeys.privateKey}
Address = 10.0.0.2/24
DNS = 1.1.1.1
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
      password: options.password
    });
  });
};
