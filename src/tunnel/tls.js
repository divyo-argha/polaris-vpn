import net from 'net';
import tls from 'tls';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import notifier from 'node-notifier';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_DIR = path.join(os.homedir(), '.config', 'polaris');
const PID_FILE = path.join(CONFIG_DIR, 'tunnel.pid');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

const ensureDir = () => {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
};

// SOCKS5 to TLS proxy server
export const createSocksToTlsProxy = (localPort, remoteServer, remotePort = 8443) => {
  const server = net.createServer((clientSocket) => {
    let stage = 0; // 0: Greeting, 1: Request, 2: Connected

    clientSocket.on('data', (data) => {
      if (stage === 0) {
        // Greeting
        if (data[0] !== 0x05) {
          clientSocket.destroy();
          return;
        }
        // Respond with SOCKS5, No Authentication
        clientSocket.write(Buffer.from([0x05, 0x00]));
        stage = 1;
      } else if (stage === 1) {
        // Request
        if (data[0] !== 0x05 || data[1] !== 0x01) {
          // Only CONNECT is supported
          clientSocket.write(Buffer.from([0x05, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
          clientSocket.destroy();
          return;
        }

        const atyp = data[3];
        let host = '';
        let offset = 4;

        if (atyp === 0x01) {
          // IPv4
          host = `${data[4]}.${data[5]}.${data[6]}.${data[7]}`;
          offset = 8;
        } else if (atyp === 0x03) {
          // Domain
          const len = data[4];
          host = data.toString('utf8', 5, 5 + len);
          offset = 5 + len;
        } else if (atyp === 0x04) {
          // IPv6 (not fully supported, but parse the bytes)
          host = data.slice(4, 20).toString('hex');
          offset = 20;
        } else {
          clientSocket.write(Buffer.from([0x05, 0x08, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
          clientSocket.destroy();
          return;
        }

        const port = data.readUInt16BE(offset);

        // Connect to remote TLS server
        const tlsSocket = tls.connect({
          host: remoteServer,
          port: remotePort,
          rejectUnauthorized: false, // Self-signed certs
          minVersion: 'TLSv1.3'
        }, () => {
          tlsSocket.write(`CONNECT ${host}:${port}\n`);
        });

        let responseBuffer = '';
        const onTlsData = (chunk) => {
          responseBuffer += chunk.toString('utf8');
          const lineEnd = responseBuffer.indexOf('\n');
          if (lineEnd !== -1) {
            const line = responseBuffer.substring(0, lineEnd).trim();
            tlsSocket.removeListener('data', onTlsData);

            if (line === 'OK') {
              // Respond success to client
              clientSocket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
              stage = 2;
              
              // Pipe rest of buffers if any
              const rest = responseBuffer.substring(lineEnd + 1);
              if (rest.length > 0) {
                clientSocket.write(Buffer.from(rest, 'utf8'));
              }
              
              clientSocket.pipe(tlsSocket);
              tlsSocket.pipe(clientSocket);
            } else {
              clientSocket.write(Buffer.from([0x05, 0x05, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
              clientSocket.destroy();
              tlsSocket.destroy();
            }
          }
        };

        tlsSocket.on('data', onTlsData);

        tlsSocket.on('error', () => {
          try {
            clientSocket.write(Buffer.from([0x05, 0x01, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
            clientSocket.destroy();
          } catch (e) {}
        });

        clientSocket.on('error', () => {
          tlsSocket.destroy();
        });
      }
    });
  });

  server.listen(localPort, '127.0.0.1');
  return server;
};

// Spawn background proxy with keepalive/reconnect checks
export const startTlsBackground = (localPort, remoteServer, remotePort = 8443) => {
  ensureDir();
  
  const runnerScript = path.join(__dirname, 'tls-runner.js');

  const child = spawn('node', [runnerScript], {
    detached: true,
    stdio: 'ignore',
    env: {
      ...process.env,
      POLARIS_LOCAL_PORT: String(localPort),
      POLARIS_REMOTE_SERVER: remoteServer,
      POLARIS_REMOTE_PORT: String(remotePort)
    }
  });

  child.unref();

  // Save tunnel information
  fs.writeFileSync(PID_FILE, String(child.pid), 'utf-8');
  const config = {
    server: remoteServer,
    port: localPort,
    mode: 'tls',
    startTime: new Date().toISOString()
  };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');

  return child.pid;
};
