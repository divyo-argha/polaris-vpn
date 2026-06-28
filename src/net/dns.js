import dns2 from 'dns2';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_DIR = path.join(os.homedir(), '.config', 'polaris');
const DNS_PID_FILE = path.join(CONFIG_DIR, 'dns.pid');
const DNS_CONFIG_FILE = path.join(CONFIG_DIR, 'dns.json');

const ensureDir = () => {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
};

// Resolves a question using DoH JSON API
export const resolveViaDoh = async (name, typeNum, upstreamUrl) => {
  // Map type number to name if possible, or use standard ones
  const typeMap = {
    1: 'A',
    28: 'AAAA',
    15: 'MX',
    16: 'TXT',
    5: 'CNAME',
    2: 'NS',
    6: 'SOA',
    12: 'PTR'
  };
  const typeName = typeMap[typeNum] || 'A';
  
  const url = `${upstreamUrl}?name=${encodeURIComponent(name)}&type=${typeName}`;
  const response = await fetch(url, {
    headers: { 'accept': 'application/dns-json' }
  });
  
  if (!response.ok) {
    throw new Error(`Upstream returned ${response.status}`);
  }
  
  return await response.json();
};

export const startDnsServerInstance = (port = 5353, upstream = 'https://cloudflare-dns.com/dns-query') => {
  const { Packet } = dns2;

  const server = dns2.createServer({
    udp: true,
    handle: async (request, send) => {
      const response = Packet.createResponseFromRequest(request);
      
      for (const question of request.questions) {
        try {
          const dohRes = await resolveViaDoh(question.name, question.type, upstream);
          if (dohRes.Answer) {
            for (const ans of dohRes.Answer) {
              response.answers.push({
                name: ans.name,
                type: ans.type,
                class: Packet.CLASS.IN,
                ttl: ans.TTL || 300,
                address: ans.data
              });
            }
          }
        } catch (err) {
          // Fallback or ignore on resolve failure
        }
      }
      
      send(response);
    }
  });

  server.listen({ udp: port }).then(() => {
    console.log(`Polaris DNS-over-HTTPS local resolver listening on 127.0.0.1:${port}`);
    console.log(`Using upstream: ${upstream}`);
  }).catch((err) => {
    console.error('DNS server failed to start:', err);
  });

  server.on('error', (err) => {
    console.error('DNS server error:', err);
  });
  
  return server;
};

// Background running capabilities for polaris CLI
export const startDnsBackground = (port = 5354, upstream = 'https://cloudflare-dns.com/dns-query') => {
  const active = getDnsStatus();
  if (active) {
    throw new Error(`DNS resolver is already running (PID: ${active.pid})`);
  }

  ensureDir();
  
  // We spawn a separate background node process running our server script
  const serverScript = path.join(__dirname, 'dns-runner.js');

  const child = spawn('node', [serverScript], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      POLARIS_DNS_PORT: String(port),
      POLARIS_DNS_UPSTREAM: upstream
    }
  });

  child.unref();

  fs.writeFileSync(DNS_PID_FILE, String(child.pid), 'utf-8');
  fs.writeFileSync(DNS_CONFIG_FILE, JSON.stringify({
    port,
    upstream,
    pid: child.pid,
    startTime: new Date().toISOString()
  }, null, 2), 'utf-8');

  return child.pid;
};

export const getDnsStatus = () => {
  if (!fs.existsSync(DNS_PID_FILE) || !fs.existsSync(DNS_CONFIG_FILE)) {
    return null;
  }
  
  try {
    const pid = parseInt(fs.readFileSync(DNS_PID_FILE, 'utf-8').trim(), 10);
    const config = JSON.parse(fs.readFileSync(DNS_CONFIG_FILE, 'utf-8'));
    
    // Check if process exists
    try {
      process.kill(pid, 0);
    } catch (e) {
      if (e.code === 'ESRCH') {
        clearDnsStatus();
        return null;
      }
    }
    
    return { pid, ...config };
  } catch (err) {
    return null;
  }
};

export const stopDnsServer = () => {
  const status = getDnsStatus();
  if (status) {
    try {
      process.kill(status.pid, 'SIGTERM');
    } catch (e) {}
  }
  clearDnsStatus();
};

export const clearDnsStatus = () => {
  if (fs.existsSync(DNS_PID_FILE)) {
    fs.unlinkSync(DNS_PID_FILE);
  }
  if (fs.existsSync(DNS_CONFIG_FILE)) {
    fs.unlinkSync(DNS_CONFIG_FILE);
  }
};
