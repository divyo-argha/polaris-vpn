import { spawn } from 'child_process';
import net from 'net';
import fs from 'fs';
import path from 'path';
import os from 'os';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'polaris');
const PID_FILE = path.join(CONFIG_DIR, 'tunnel.pid');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const ensureDir = () => {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
};

export const spawnSSH = (server, port) => {
  // We want to run SSH as a detached child process so it survives terminal close.
  // -D port: Dynamic SOCKS5 forwarding
  // -N: Do not execute a remote command
  // -o StrictHostKeyChecking=no: Don't prompt for host key verification
  // -o ServerAliveInterval=30: Keep connection alive
  // -o ExitOnForwardFailure=yes: Exit if port forwarding fails
  
  const args = [
    '-D', String(port),
    '-N',
    '-o', 'StrictHostKeyChecking=no',
    '-o', 'ServerAliveInterval=30',
    '-o', 'ExitOnForwardFailure=yes',
    server
  ];

  const child = spawn('ssh', args, {
    detached: true,
    stdio: 'ignore' // We don't want to capture stdio, keep it completely detached
  });

  child.unref(); // Allow the parent process to exit independently

  return child.pid;
};

// Poll the local port until it accepts connections
export const waitForSocks = async (port, timeoutMs = 30000) => {
  const start = Date.now();
  
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const socket = new net.Socket();
        
        socket.setTimeout(1000);
        
        socket.on('connect', () => {
          socket.destroy();
          resolve(true);
        });
        
        socket.on('timeout', () => {
          socket.destroy();
          reject(new Error('timeout'));
        });
        
        socket.on('error', (err) => {
          socket.destroy();
          reject(err);
        });
        
        socket.connect(port, '127.0.0.1');
      });
      return true; // Connection successful
    } catch (err) {
      // Wait 500ms before retrying
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  throw new Error(`Timed out waiting for SOCKS5 proxy on port ${port} to become ready`);
};

export const saveTunnelInfo = (pid, server, port) => {
  ensureDir();
  fs.writeFileSync(PID_FILE, String(pid), 'utf-8');
  
  const config = {
    server,
    port,
    startTime: new Date().toISOString()
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
};

export const getTunnelInfo = () => {
  if (!fs.existsSync(PID_FILE) || !fs.existsSync(CONFIG_FILE)) {
    return null;
  }
  
  try {
    const pid = parseInt(fs.readFileSync(PID_FILE, 'utf-8').trim(), 10);
    const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    
    // Check if process actually exists
    try {
      process.kill(pid, 0); // test signal 0 to check if alive
    } catch (e) {
      if (e.code === 'ESRCH') {
        // Process doesn't exist, tunnel is dead, cleanup
        clearTunnelInfo();
        return null;
      }
    }
    
    return { pid, ...config };
  } catch (err) {
    return null;
  }
};

export const stopTunnel = () => {
  const info = getTunnelInfo();
  if (info) {
    try {
      process.kill(info.pid, 'SIGTERM');
    } catch (e) {
      // Ignore errors if process already dead
    }
  }
  clearTunnelInfo();
};

export const clearTunnelInfo = () => {
  if (fs.existsSync(PID_FILE)) fs.unlinkSync(PID_FILE);
};
