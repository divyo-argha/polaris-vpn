import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { generateKeyPair } from '../tunnel/wg.js';
import { CONFIG_DIR, ensureDir } from '../utils/config.js';

const DEPLOY_JSON = path.join(CONFIG_DIR, 'wg', 'deploy.json');

const getDeployInfo = () => {
  if (!fs.existsSync(DEPLOY_JSON)) {
    throw new Error('No deployment found. Please deploy a server first using "polaris deploy".');
  }
  return JSON.parse(fs.readFileSync(DEPLOY_JSON, 'utf-8'));
};

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

const sshConnect = (info) => {
  const parts = info.server.split('@');
  const username = parts.length > 1 ? parts[0] : 'ubuntu';
  const host = parts.length > 1 ? parts[1] : parts[0];
  
  const privateKey = getDefaultPrivateKey();

  const conn = new Client();
  return new Promise((resolve, reject) => {
    conn.on('ready', () => resolve(conn))
        .on('error', (err) => reject(err));
    conn.connect({
      host,
      port: 22,
      username,
      privateKey
    });
  });
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

export const addPeer = async (name) => {
  const info = getDeployInfo();
  const conn = await sshConnect(info);
  const isAwg = info.mode === 'amneziawg';
  const confFile = isAwg ? '/etc/amnezia/amneziawg/awg0.conf' : '/etc/wireguard/wg0.conf';
  const quickCmd = isAwg ? 'awg-quick@awg0' : 'wg-quick@wg0';

  try {
    // 1. Read remote config
    const catRes = await sshExec(conn, `sudo cat ${confFile}`);
    if (catRes.code !== 0) throw new Error(`Failed to read server config: ${catRes.stderr}`);
    const configContent = catRes.stdout;

    // Check if name already exists
    if (configContent.includes(`# Name: ${name}\n`) || configContent.includes(`# Name: ${name}\r\n`)) {
      throw new Error(`Peer with name '${name}' already exists.`);
    }

    // Parse IPs to find next free IP
    const ipMatches = [...configContent.matchAll(/AllowedIPs\s*=\s*10\.0\.0\.(\d+)\/32/g)];
    let nextIpIndex = 2;
    if (ipMatches.length > 0) {
      const indices = ipMatches.map(m => parseInt(m[1], 10));
      nextIpIndex = Math.max(...indices) + 1;
    }
    
    if (nextIpIndex >= 254) {
      throw new Error('IP range exhausted for subnet 10.0.0.0/24');
    }

    const peerIp = `10.0.0.${nextIpIndex}`;
    const peerKeys = generateKeyPair();

    // 2. Append peer to remote wg0.conf
    const peerConfigBlock = `\n[Peer]
# Name: ${name}
PublicKey = ${peerKeys.publicKey}
AllowedIPs = ${peerIp}/32
`;

    const writeCmd = `echo "${peerConfigBlock.replace(/"/g, '\\"')}" | sudo tee -a ${confFile}`;
    let res = await sshExec(conn, writeCmd);
    if (res.code !== 0) throw new Error(`Failed to append remote peer: ${res.stderr}`);

    // Sync remote tunnel
    await sshExec(conn, `sudo systemctl restart ${quickCmd}`);

    let obfuscationBlock = '';
    if (isAwg && info.awgParams) {
      obfuscationBlock = `Jc = ${info.awgParams.Jc}
Jmin = ${info.awgParams.Jmin}
Jmax = ${info.awgParams.Jmax}
S1 = ${info.awgParams.S1}
S2 = ${info.awgParams.S2}
H1 = ${info.awgParams.H1}
H2 = ${info.awgParams.H2}
H3 = ${info.awgParams.H3}
H4 = ${info.awgParams.H4}`;
    }

    // 3. Save peer config locally
    const clientConf = `[Interface]
PrivateKey = ${peerKeys.privateKey}
Address = ${peerIp}/24
DNS = 10.0.0.1
${obfuscationBlock}

[Peer]
PublicKey = ${info.serverPublicKey}
Endpoint = ${info.server.split('@')[1]}:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
`;

    const peersDir = path.join(CONFIG_DIR, 'wg', 'peers');
    ensureDir(peersDir);
    const peerConfPath = path.join(peersDir, `${name}.conf`);
    fs.writeFileSync(peerConfPath, clientConf, 'utf-8');

    conn.end();
    return { name, ip: peerIp, publicKey: peerKeys.publicKey, confPath: peerConfPath };
  } catch (err) {
    conn.end();
    throw err;
  }
};

export const listPeers = async () => {
  const info = getDeployInfo();
  const conn = await sshConnect(info);
  const isAwg = info.mode === 'amneziawg';
  const confFile = isAwg ? '/etc/amnezia/amneziawg/awg0.conf' : '/etc/wireguard/wg0.conf';
  const showCmd = isAwg ? 'awg show awg0 dump' : 'wg show wg0 dump';

  try {
    // 1. Read remote configuration to parse names
    const catRes = await sshExec(conn, `sudo cat ${confFile}`);
    if (catRes.code !== 0) throw new Error('Failed to read remote config');
    const content = catRes.stdout;

    // Parse blocks
    const lines = content.split('\n');
    const peersMap = {}; // publicKey -> name
    let currentName = 'Default Client';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('# Name:')) {
        currentName = line.substring(7).trim();
      }
      if (line.startsWith('PublicKey')) {
        const pk = line.split('=')[1].trim();
        peersMap[pk] = currentName;
      }
    }

    // 2. Fetch tunnel status
    const showRes = await sshExec(conn, `sudo ${showCmd}`);
    if (showRes.code !== 0) throw new Error('Failed to run show command');
    
    const dumpLines = showRes.stdout.trim().split('\n');
    const list = [];

    // First line is server key info, subsequent lines are peers
    for (let i = 1; i < dumpLines.length; i++) {
      const parts = dumpLines[i].split('\t');
      if (parts.length < 8) continue;
      const [publicKey, , endpoint, allowedIps, latestHandshake, transferRx, transferTx] = parts;
      
      list.push({
        name: peersMap[publicKey] || 'Unknown',
        publicKey,
        endpoint: endpoint === '(none)' ? 'Disconnected' : endpoint,
        ip: allowedIps,
        handshake: parseInt(latestHandshake, 10) === 0 ? 'Never' : `${Math.floor(Date.now() / 1000 - parseInt(latestHandshake, 10))}s ago`,
        transferRx: `${Math.round(parseInt(transferRx, 10) / 1024 / 1024 * 100) / 100} MB`,
        transferTx: `${Math.round(parseInt(transferTx, 10) / 1024 / 1024 * 100) / 100} MB`
      });
    }

    conn.end();
    return list;
  } catch (err) {
    conn.end();
    throw err;
  }
};

export const removePeer = async (name) => {
  const info = getDeployInfo();
  const conn = await sshConnect(info);
  const isAwg = info.mode === 'amneziawg';
  const confFile = isAwg ? '/etc/amnezia/amneziawg/awg0.conf' : '/etc/wireguard/wg0.conf';
  const quickCmd = isAwg ? 'awg-quick@awg0' : 'wg-quick@wg0';

  try {
    const catRes = await sshExec(conn, `sudo cat ${confFile}`);
    if (catRes.code !== 0) throw new Error('Failed to read remote config');
    const content = catRes.stdout;

    if (!content.includes(`# Name: ${name}`)) {
      throw new Error(`Peer '${name}' not found on server.`);
    }

    // Strip peer block from remote config
    const blocks = content.split('[Peer]');
    const filteredBlocks = blocks.filter(b => !b.includes(`# Name: ${name}`));
    const newContent = filteredBlocks.join('[Peer]');

    // Save remote config back
    const writeRes = await sshExec(conn, `cat << 'EOF' > /tmp/temp.conf\n${newContent}\nEOF\nsudo mv /tmp/temp.conf ${confFile} && sudo chmod 600 ${confFile}`);
    if (writeRes.code !== 0) throw new Error('Failed to update remote config');

    // Sync remote tunnel
    await sshExec(conn, `sudo systemctl restart ${quickCmd}`);

    // Remove local peer config if it exists
    const peerConfPath = path.join(CONFIG_DIR, 'wg', 'peers', `${name}.conf`);
    if (fs.existsSync(peerConfPath)) {
      fs.unlinkSync(peerConfPath);
    }

    conn.end();
    return true;
  } catch (err) {
    conn.end();
    throw err;
  }
};

export const getLocalPeerConfPath = (name) => {
  const peerConfPath = path.join(CONFIG_DIR, 'wg', 'peers', `${name}.conf`);
  if (!fs.existsSync(peerConfPath)) {
    throw new Error(`Local config for peer '${name}' not found.`);
  }
  return peerConfPath;
};
