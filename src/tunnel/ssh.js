import { spawn } from 'child_process';
import net from 'net';

export const spawnSSH = (server, port) => {
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
    stdio: 'ignore'
  });

  child.unref();
  return child.pid;
};

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
      return true;
    } catch (err) {
      await new Promise(r => setTimeout(r, 500));
    }
  }
  
  throw new Error(`Timed out waiting for SOCKS5 proxy on port ${port} to become ready`);
};
