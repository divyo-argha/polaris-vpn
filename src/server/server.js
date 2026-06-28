#!/usr/bin/env node
import tls from 'tls';
import net from 'net';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { execSync } from 'child_process';

const CONFIG_DIR = path.join(os.homedir(), '.config', 'polaris-server');
const KEY_FILE = path.join(CONFIG_DIR, 'server.key');
const CERT_FILE = path.join(CONFIG_DIR, 'server.crt');

const ensureConfigDir = () => {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
};

const generateCerts = () => {
  ensureConfigDir();
  if (fs.existsSync(KEY_FILE) && fs.existsSync(CERT_FILE)) {
    return;
  }
  console.log('Generating self-signed TLS certificates...');
  try {
    execSync(
      `openssl req -x509 -newkey rsa:2048 -nodes -sha256 -keyout "${KEY_FILE}" -out "${CERT_FILE}" -days 365 -subj "/CN=polaris"`,
      { stdio: 'ignore' }
    );
    console.log('Certificates generated successfully.');
  } catch (err) {
    console.error('Failed to generate TLS certificates using openssl CLI:', err.message);
    process.exit(1);
  }
};

const startServer = (port = 8443) => {
  generateCerts();

  const options = {
    key: fs.readFileSync(KEY_FILE),
    cert: fs.readFileSync(CERT_FILE),
    minVersion: 'TLSv1.3'
  };

  const server = tls.createServer(options, (cleartextStream) => {
    let buffer = '';
    
    const onData = (chunk) => {
      buffer += chunk.toString('utf8');
      const lineEnd = buffer.indexOf('\n');
      if (lineEnd !== -1) {
        const line = buffer.substring(0, lineEnd).trim();
        buffer = buffer.substring(lineEnd + 1);
        
        cleartextStream.removeListener('data', onData);
        
        const match = line.match(/^CONNECT\s+(.+):(\d+)$/);
        if (!match) {
          cleartextStream.write('ERR Invalid command\n');
          cleartextStream.end();
          return;
        }
        
        const host = match[1];
        const targetPort = parseInt(match[2], 10);
        
        const targetSocket = net.connect(targetPort, host, () => {
          cleartextStream.write('OK\n');
          if (buffer.length > 0) {
            targetSocket.write(buffer);
          }
          cleartextStream.pipe(targetSocket);
          targetSocket.pipe(cleartextStream);
        });
        
        targetSocket.on('error', (err) => {
          try {
            cleartextStream.write(`ERR ${err.message}\n`);
            cleartextStream.end();
          } catch (e) {}
        });
        
        cleartextStream.on('error', () => {
          targetSocket.destroy();
        });
      }
    };
    
    cleartextStream.on('data', onData);
  });

  server.listen(port, () => {
    console.log(`Polaris TLS Server listening on port ${port}`);
  });
  
  server.on('error', (err) => {
    console.error('Server error:', err);
  });
};

const args = process.argv.slice(2);
const portOptIdx = args.indexOf('--port');
let port = 8443;
if (portOptIdx !== -1 && args[portOptIdx + 1]) {
  port = parseInt(args[portOptIdx + 1], 10);
}

startServer(port);
