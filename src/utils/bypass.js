import { store } from './config.js';
import dns from 'dns';
import { promisify } from 'util';
import { spawnSync } from 'child_process';
import os from 'os';

const resolve4 = promisify(dns.resolve4);

export const getBypassRules = () => {
  return store.get('bypassRules', []);
};

export const addBypassRule = (target) => {
  const rules = getBypassRules();
  if (rules.includes(target)) {
    throw new Error(`Bypass rule for '${target}' already exists.`);
  }
  rules.push(target);
  store.set('bypassRules', rules);
  return rules;
};

export const removeBypassRule = (target) => {
  let rules = getBypassRules();
  if (!rules.includes(target)) {
    throw new Error(`Bypass rule '${target}' not found.`);
  }
  rules = rules.filter(r => r !== target);
  store.set('bypassRules', rules);
  return rules;
};

const resolveTargetIps = async (target) => {
  const isIp = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(\/\d{1,2})?$/.test(target);
  if (isIp) return [target];

  try {
    const ips = await resolve4(target);
    return ips;
  } catch (err) {
    return [];
  }
};

export const applyBypassRules = async () => {
  const rules = getBypassRules();
  if (rules.length === 0) return;

  const platform = os.platform();
  
  // Find default gateway
  let gateway = null;
  try {
    if (platform === 'darwin') {
      const res = spawnSync('route', ['-n', 'get', 'default'], { encoding: 'utf-8' });
      const match = res.stdout.match(/gateway:\s*([\d.]+)/);
      if (match) gateway = match[1];
    } else if (platform === 'linux') {
      const res = spawnSync('ip', ['route', 'show', 'default'], { encoding: 'utf-8' });
      const match = res.stdout.match(/via\s*([\d.]+)/);
      if (match) gateway = match[1];
    }
  } catch (e) {}

  if (!gateway) return;

  for (const rule of rules) {
    const ips = await resolveTargetIps(rule);
    for (const ip of ips) {
      try {
        if (platform === 'darwin') {
          spawnSync('sudo', ['route', '-n', 'add', '-host', ip, gateway], { stdio: 'ignore' });
        } else if (platform === 'linux') {
          spawnSync('sudo', ['ip', 'route', 'add', ip, 'via', gateway], { stdio: 'ignore' });
        }
      } catch (e) {}
    }
  }
};
