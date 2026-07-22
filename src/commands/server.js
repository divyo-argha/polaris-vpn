#!/usr/bin/env node
import { printSuccess, printInfo } from '../utils/display.js';
import { handleError } from '../utils/error-handler.js';
import { startApiServer } from '../server/api.js';

export const serverStart = async (options = {}) => {
  const isJson = options.json;
  
  try {
    if (!isJson) {
      printInfo('Starting local REST API server...');
    }

    const port = parseInt(options.port || '7070', 10);
    await startApiServer(port);

    if (isJson) {
      console.log(JSON.stringify({ success: true, url: `http://127.0.0.1:${port}` }));
    } else {
      printSuccess(`Local API running at http://127.0.0.1:${port}`);
      console.log(`
Endpoints:
  GET  /status     — Get tunnel state
  POST /connect    — Start tunnel { "server": "user@host", "mode": "auto" }
  POST /disconnect — Stop active tunnel
  GET  /peers      — List WireGuard peers (requires active deploy)
`);
    }
  } catch (err) {
    handleError('Failed to start local API', err, isJson);
  }
};

if (process.argv[1] && process.argv[1].endsWith('server.js')) {
  const portIndex = process.argv.indexOf('-p') !== -1 ? process.argv.indexOf('-p') + 1 : process.argv.indexOf('--port') !== -1 ? process.argv.indexOf('--port') + 1 : -1;
  const port = portIndex > 0 && process.argv[portIndex] ? process.argv[portIndex] : '7070';
  const isJson = process.argv.includes('--json');
  serverStart({ port, json: isJson });
}
