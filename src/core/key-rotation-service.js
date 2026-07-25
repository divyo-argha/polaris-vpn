import { Client } from 'ssh2';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { generateKeyPair } from '../tunnel/wg.js';
import { CONFIG_DIR, ensureDir, store } from '../utils/config.js';
import { logEvent } from '../utils/logger.js';

const DEPLOY_JSON = path.join(CONFIG_DIR, 'wg', 'deploy.json');
const ROTATION_LOG = path.join(CONFIG_DIR, 'rotation-log.json');

const getDefaultPrivateKey = () => {
  const keys = ['id_rsa', 'id_ed25519', 'id_ecdsa', 'id_dsa'];
  for (const k of keys) {
    const p = path.join(os.homedir(), '.ssh', k);
    if (fs.existsSync(p)) return fs.readFileSync(p);
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
      }).on('data', d => { stdout += d.toString('utf8'); })
        .stderr.on('data', d => { stderr += d.toString('utf8'); });
    });
  });
};

/**
 * Reads the persisted rotation schedule config.
 * @returns {{ intervalDays: number, lastRotated: string|null }}
 */
export const getRotationConfig = () => ({
  intervalDays: store.get('rotation.intervalDays', 0),
  lastRotated: store.get('rotation.lastRotated', null)
});

/**
 * Saves rotation schedule config.
 * @param {{ intervalDays?: number, lastRotated?: string }} config
 */
export const setRotationConfig = (config) => {
  if (typeof config.intervalDays === 'number') {
    store.set('rotation.intervalDays', config.intervalDays);
  }
  if (config.lastRotated !== undefined) {
    store.set('rotation.lastRotated', config.lastRotated);
  }
};

/**
 * Returns true if a rotation is due based on the saved schedule.
 */
export const isRotationDue = () => {
  const { intervalDays, lastRotated } = getRotationConfig();
  if (!intervalDays || intervalDays <= 0) return false;
  if (!lastRotated) return true;
  const daysSince = (Date.now() - new Date(lastRotated).getTime()) / 86_400_000;
  return daysSince >= intervalDays;
};

/**
 * Rotates WireGuard keys:
 * 1. Generates a new client keypair locally
 * 2. SSHes into the server and replaces the peer's PublicKey in the config
 * 3. Restarts the WireGuard service on the server
 * 4. Writes a new local client conf with the fresh keys
 * 5. Saves a rotation log entry
 *
 * @param {{ onProgress?: (msg: string) => void }} [options]
 */
export const rotateKeys = async (options = {}) => {
  if (!fs.existsSync(DEPLOY_JSON)) {
    throw new Error('No deployment found. Please deploy a server first using "polaris deploy".');
  }

  const info = JSON.parse(fs.readFileSync(DEPLOY_JSON, 'utf-8'));
  const { server, mode, serverPublicKey, awgParams } = info;
  const isAwg = mode === 'amneziawg';
  const ifaceName = isAwg ? 'awg0' : 'wg0';
  const confFile = isAwg
    ? `/etc/amnezia/amneziawg/${ifaceName}.conf`
    : `/etc/wireguard/${ifaceName}.conf`;
  const quickCmd = isAwg ? `awg-quick@${ifaceName}` : `wg-quick@${ifaceName}`;

  const parts = server.split('@');
  const username = parts.length > 1 ? parts[0] : 'ubuntu';
  const host = parts.length > 1 ? parts[1] : parts[0];

  const onProgress = options.onProgress || (() => {});

  onProgress('Generating new key pair...');
  const newKeys = generateKeyPair();

  const privateKey = getDefaultPrivateKey();
  if (!privateKey) {
    throw new Error('No SSH private key found. Configure ~/.ssh/id_rsa or id_ed25519.');
  }

  const conn = new Client();

  await new Promise((resolve, reject) => {
    conn.on('ready', async () => {
      try {
        // Read current server config
        onProgress('Reading current server configuration...');
        const catRes = await sshExec(conn, `sudo cat ${confFile}`);
        if (catRes.code !== 0) throw new Error(`Failed to read server config: ${catRes.stderr}`);

        const currentConf = catRes.stdout;

        // Find old client public key (stored in deploy.json) and replace it
        const oldClientKey = JSON.parse(fs.readFileSync(DEPLOY_JSON, 'utf-8')).clientPublicKey;
        if (!currentConf.includes(oldClientKey)) {
          throw new Error('Old client public key not found in server config. Rotation aborted.');
        }

        onProgress('Updating server configuration with new public key...');
        const newConf = currentConf.replace(oldClientKey, newKeys.publicKey);

        const writeCmd = `cat << 'POLARISEOF' > /tmp/${ifaceName}_new.conf\n${newConf}\nPOLARISOF\nsudo mv /tmp/${ifaceName}_new.conf ${confFile} && sudo chmod 600 ${confFile}`;
        const writeRes = await sshExec(conn, writeCmd);
        if (writeRes.code !== 0) throw new Error(`Failed to write updated server config: ${writeRes.stderr}`);

        onProgress('Restarting VPN service on server...');
        const restartRes = await sshExec(conn, `sudo systemctl restart ${quickCmd}`);
        if (restartRes.code !== 0) throw new Error(`Failed to restart service: ${restartRes.stderr}`);

        conn.end();
        resolve();
      } catch (err) {
        conn.end();
        reject(err);
      }
    }).on('error', reject);

    conn.connect({ host, port: 22, username, privateKey, readyTimeout: 10000 });
  });

  // Update local client conf with new keys
  onProgress('Saving new local client configuration...');
  let obfuscationBlock = '';
  if (isAwg && awgParams) {
    obfuscationBlock = `Jc = ${awgParams.Jc}\nJmin = ${awgParams.Jmin}\nJmax = ${awgParams.Jmax}\nS1 = ${awgParams.S1}\nS2 = ${awgParams.S2}\nH1 = ${awgParams.H1}\nH2 = ${awgParams.H2}\nH3 = ${awgParams.H3}\nH4 = ${awgParams.H4}`;
  }

  const newClientConf = `[Interface]
PrivateKey = ${newKeys.privateKey}
Address = 10.0.0.2/24
DNS = 10.0.0.1
${obfuscationBlock}

[Peer]
PublicKey = ${serverPublicKey}
Endpoint = ${host}:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
`;

  const wgDir = path.join(CONFIG_DIR, 'wg');
  ensureDir(wgDir);
  fs.writeFileSync(path.join(wgDir, `${ifaceName}.conf`), newClientConf, 'utf-8');

  // Update deploy.json with new client public key
  const updatedInfo = { ...info, clientPublicKey: newKeys.publicKey };
  fs.writeFileSync(DEPLOY_JSON, JSON.stringify(updatedInfo, null, 2), 'utf-8');

  // Append rotation log entry
  const rotationEntry = {
    ts: new Date().toISOString(),
    server,
    mode,
    oldPublicKey: info.clientPublicKey,
    newPublicKey: newKeys.publicKey
  };
  const rotLog = fs.existsSync(ROTATION_LOG)
    ? JSON.parse(fs.readFileSync(ROTATION_LOG, 'utf-8'))
    : [];
  rotLog.push(rotationEntry);
  fs.writeFileSync(ROTATION_LOG, JSON.stringify(rotLog, null, 2), 'utf-8');

  // Update schedule timestamp
  setRotationConfig({ lastRotated: rotationEntry.ts });

  logEvent('KEY_ROTATE', `Keys rotated for ${server}`, { mode, newPublicKey: newKeys.publicKey });

  return { newPublicKey: newKeys.publicKey, confPath: path.join(wgDir, `${ifaceName}.conf`) };
};
