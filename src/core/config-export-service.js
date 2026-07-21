import fs from 'fs';
import path from 'path';
import { CONFIG_DIR, ensureDir } from '../utils/config.js';
import { addProfile, getProfiles } from './profile-service.js';

export const parseWgConfig = (content) => {
  const lines = content.split(/\r?\n/);
  const result = { interface: {}, peer: {} };
  let currentSection = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      currentSection = trimmed.slice(1, -1).toLowerCase();
      continue;
    }

    const eqIdx = trimmed.indexOf('=');
    if (eqIdx !== -1 && currentSection) {
      const key = trimmed.substring(0, eqIdx).trim();
      const val = trimmed.substring(eqIdx + 1).trim();
      if (currentSection === 'interface') {
        result.interface[key] = val;
      } else if (currentSection === 'peer') {
        result.peer[key] = val;
      }
    }
  }

  return result;
};

export const importWgConfig = (filePath, aliasName = null) => {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const parsed = parseWgConfig(content);

  if (!parsed.peer.Endpoint) {
    throw new Error('Invalid config: Missing [Peer] Endpoint');
  }

  const alias = aliasName || path.parse(filePath).name;
  const endpoint = parsed.peer.Endpoint;

  // Save config locally
  const wgDir = path.join(CONFIG_DIR, 'wg');
  ensureDir(wgDir);
  const targetConf = path.join(wgDir, `${alias}.conf`);
  fs.writeFileSync(targetConf, content, 'utf-8');

  // Register profile
  addProfile(alias, endpoint);

  return { alias, endpoint, configPath: targetConf, parsed };
};

export const exportWgConfig = (alias) => {
  const wgDir = path.join(CONFIG_DIR, 'wg');
  const targetConf = path.join(wgDir, `${alias}.conf`);
  
  if (fs.existsSync(targetConf)) {
    return fs.readFileSync(targetConf, 'utf-8');
  }

  const peersDir = path.join(CONFIG_DIR, 'wg', 'peers');
  const peerConf = path.join(peersDir, `${alias}.conf`);
  if (fs.existsSync(peerConf)) {
    return fs.readFileSync(peerConf, 'utf-8');
  }

  const wg0Conf = path.join(wgDir, 'wg0.conf');
  if (fs.existsSync(wg0Conf)) {
    return fs.readFileSync(wg0Conf, 'utf-8');
  }

  throw new Error(`Configuration profile for '${alias}' not found.`);
};
