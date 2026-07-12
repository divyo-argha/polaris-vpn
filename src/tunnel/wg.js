import { spawnSync, spawn } from 'child_process';
import crypto from 'crypto';
import os from 'os';
import path from 'path';

// Pure JS Curve25519/X25519 key generator matching WireGuard format
export const generateKeyPair = () => {
  const rawPriv = crypto.randomBytes(32);
  // Apply Curve25519 private key clamping:
  // - clear the lowest three bits of the first byte
  // - clear the highest bit of the last byte
  // - set the second highest bit of the last byte
  rawPriv[0] &= 248;
  rawPriv[31] &= 127;
  rawPriv[31] |= 64;

  const keyDer = Buffer.concat([
    Buffer.from('302e020100300506032b656e04220420', 'hex'),
    rawPriv
  ]);
  
  const priv = crypto.createPrivateKey({ key: keyDer, format: 'der', type: 'pkcs8' });
  const pub = crypto.createPublicKey(priv);
  const pubRaw = pub.export({ format: 'der', type: 'spki' }).slice(-32);

  return {
    privateKey: rawPriv.toString('base64'),
    publicKey: pubRaw.toString('base64')
  };
};

export const generateAwgParams = () => {
  return {
    Jc: crypto.randomInt(1, 100),
    Jmin: crypto.randomInt(1, 50),
    Jmax: crypto.randomInt(50, 1000),
    S1: crypto.randomInt(15, 150),
    S2: crypto.randomInt(15, 150),
    H1: crypto.randomInt(1, 2147483647),
    H2: crypto.randomInt(1, 2147483647),
    H3: crypto.randomInt(1, 2147483647),
    H4: crypto.randomInt(1, 2147483647)
  };
};

export const startWgTunnel = (confPath, isJson = false, isAwg = false) => {
  const isWin = os.platform() === 'win32';
  const quickCmd = isAwg ? 'awg-quick' : 'wg-quick';
  const serviceCmd = isAwg ? 'amneziawg' : 'wireguard';

  if (!isWin) {
    const sudoCheck = spawnSync('sudo', ['-n', 'true']);
    if (sudoCheck.status !== 0 && isJson) {
      throw new Error('Sudo privileges required. Please run with "sudo polaris start ..." for JSON mode.');
    }
  }

  if (isWin) {
    const res = spawnSync(serviceCmd, ['/installtunnelservice', confPath], {
      stdio: isJson ? 'ignore' : 'inherit'
    });
    if (res.status !== 0) {
      throw new Error(`${serviceCmd} /installtunnelservice failed (ensure Admin privileges) with code ${res.status}`);
    }
    return process.pid;
  }

  const res = spawnSync('sudo', [quickCmd, 'up', confPath], {
    stdio: isJson ? 'ignore' : 'inherit'
  });
  
  if (res.status !== 0) {
    throw new Error(`${quickCmd} up failed with code ${res.status}`);
  }
  return process.pid;
};

export const stopWgTunnel = (confPath, isJson = false, isAwg = false) => {
  const isWin = os.platform() === 'win32';
  const quickCmd = isAwg ? 'awg-quick' : 'wg-quick';
  const serviceCmd = isAwg ? 'amneziawg' : 'wireguard';

  if (!isWin) {
    const sudoCheck = spawnSync('sudo', ['-n', 'true']);
    if (sudoCheck.status !== 0 && isJson) {
      throw new Error('Sudo privileges required. Please run with "sudo polaris stop" for JSON mode.');
    }
  }

  if (isWin) {
    const interfaceName = path.parse(confPath).name;
    const res = spawnSync(serviceCmd, ['/uninstalltunnelservice', interfaceName], {
      stdio: isJson ? 'ignore' : 'inherit'
    });
    if (res.status !== 0) {
      throw new Error(`${serviceCmd} /uninstalltunnelservice failed with code ${res.status}`);
    }
    return;
  }

  const res = spawnSync('sudo', [quickCmd, 'down', confPath], {
    stdio: isJson ? 'ignore' : 'inherit'
  });
  
  if (res.status !== 0) {
    throw new Error(`${quickCmd} down failed with code ${res.status}`);
  }
};
