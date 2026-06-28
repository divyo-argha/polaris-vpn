import fs from 'fs';
import path from 'path';
import os from 'os';
import Conf from 'conf';

export const CONFIG_DIR = path.join(os.homedir(), '.config', 'polaris');
export const TUNNEL_PID_FILE = path.join(CONFIG_DIR, 'tunnel.pid');
export const TUNNEL_CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');
export const DNS_PID_FILE = path.join(CONFIG_DIR, 'dns.pid');
export const DNS_CONFIG_FILE = path.join(CONFIG_DIR, 'dns.json');

export const ensureDir = (dir = CONFIG_DIR) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

export const store = new Conf({ projectName: 'polaris' });
