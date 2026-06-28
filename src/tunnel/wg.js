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

export const startWgTunnel = (confPath) => {
  // Spawn detached so it remains up even if process exits.
  // Requires sudo/admin.
  const child = spawn('sudo', ['wg-quick', 'up', confPath], {
    detached: true,
    stdio: 'inherit' // inherit so it prompts for sudo password on console if needed
  });
  
  child.unref();
  return child.pid;
};

export const stopWgTunnel = (confPath) => {
  const res = spawnSync('sudo', ['wg-quick', 'down', confPath], {
    stdio: 'inherit'
  });
  if (res.status !== 0) {
    throw new Error(`wg-quick down failed with code ${res.status}`);
  }
};
