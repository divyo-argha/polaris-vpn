import net from 'net';
import tls from 'tls';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnDaemon, saveDaemonState } from '../utils/daemon.js';
import { TUNNEL_PID_FILE, TUNNEL_CONFIG_FILE, ensureDir } from '../utils/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// SOCKS5 to TLS proxy server instance logic
export const createSocksToTlsProxy = (localPort, remoteServer, remotePort = 8443) => {
  const server = net.createServer((clientSocket) => {
    let stage = 0; // 0: Greeting, 1: Request, 2: Connected

    clientSocket.on('data', (data) => {
      if (stage === 0) {
        if (data[0] !== 0x05) {
          clientSocket.destroy();
          return;
        }
        clientSocket.write(Buffer.from([0x05, 0x00]));
        stage = 1;
      } else if (stage === 1) {
        if (data[0] !== 0x05 || data[1] !== 0x01) {
          clientSocket.write(Buffer.from([0x05, 0x07, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
          clientSocket.destroy();
          return;
        }

        const atyp = data[3];
        let host = '';
        let offset = 4;

        if (atyp === 0x01) {
          host = `${data[4]}.${data[5]}.${data[6]}.${data[7]}`;
          offset = 8;
        } else if (atyp === 0x03) {
          const len = data[4];
          host = data.toString('utf8', 5, 5 + len);
          offset = 5 + len;
        } else if (atyp === 0x04) {
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
          rejectUnauthorized: false,
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
              clientSocket.write(Buffer.from([0x05, 0x00, 0x00, 0x01, 0, 0, 0, 0, 0, 0]));
              stage = 2;
              
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

  const pid = spawnDaemon(runnerScript, [], {
    POLARIS_LOCAL_PORT: String(localPort),
    POLARIS_REMOTE_SERVER: remoteServer,
    POLARIS_REMOTE_PORT: String(remotePort)
  });

  saveDaemonState(TUNNEL_PID_FILE, TUNNEL_CONFIG_FILE, {
    pid,
    server: remoteServer,
    port: localPort,
    mode: 'tls',
    startTime: new Date().toISOString()
  });

  return pid;
};
