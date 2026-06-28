import fetch from 'node-fetch';
import { SocksProxyAgent } from 'socks-proxy-agent';
import dns from 'dns';
import { promisify } from 'util';

const resolve4 = promisify(dns.resolve4);

export const getPublicIp = async () => {
  const res = await fetch('https://api64.ipify.org?format=json');
  if (!res.ok) throw new Error(`HTTP ${res.status} from ipify.org`);
  const data = await res.json();
  return data.ip;
};

export const getProxiedIp = async (port) => {
  const agent = new SocksProxyAgent(`socks5h://127.0.0.1:${port}`);
  const res = await fetch('https://api64.ipify.org?format=json', { agent });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ipify.org via proxy`);
  const data = await res.json();
  return data.ip;
};

export const checkDns = async () => {
  try {
    const servers = dns.getServers();
    const resolved = await resolve4('example.com');
    return { success: resolved.length > 0, servers };
  } catch (err) {
    return { success: false, servers: dns.getServers(), error: err.message };
  }
};

export const checkIpv6Leak = async () => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch('https://ipv6.icanhazip.com', { signal: controller.signal });
    clearTimeout(timeout);
    
    if (res.ok) {
      const text = await res.text();
      return text.trim() || null;
    }
    return null;
  } catch (err) {
    return null;
  }
};
