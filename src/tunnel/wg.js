import { spawnSync, spawn } from 'child_process';
import crypto from 'crypto';

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

export const startWgTunnel = (confPath, isJson = false) => {
  const sudoCheck = spawnSync('sudo', ['-n', 'true']);
  if (sudoCheck.status !== 0 && isJson) {
    throw new Error('Sudo privileges required. Please run with "sudo polaris start ..." for JSON mode.');
  }

  const res = spawnSync('sudo', ['wg-quick', 'up', confPath], {
    stdio: isJson ? 'ignore' : 'inherit'
  });
  
  if (res.status !== 0) {
    throw new Error(`wg-quick up failed with code ${res.status}`);
  }
  return process.pid;
};

export const stopWgTunnel = (confPath, isJson = false) => {
  const sudoCheck = spawnSync('sudo', ['-n', 'true']);
  if (sudoCheck.status !== 0 && isJson) {
    throw new Error('Sudo privileges required. Please run with "sudo polaris stop" for JSON mode.');
  }

  const res = spawnSync('sudo', ['wg-quick', 'down', confPath], {
    stdio: isJson ? 'ignore' : 'inherit'
  });
  
  if (res.status !== 0) {
    throw new Error(`wg-quick down failed with code ${res.status}`);
  }
};
