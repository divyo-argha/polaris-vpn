import { printSuccess, printError, printInfo } from '../utils/display.js';
import { startApiServer } from '../server/api.js';

export const serverStart = async (options) => {
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
    if (isJson) {
      console.log(JSON.stringify({ error: err.message }));
    } else {
      printError('Failed to start local API', err);
    }
    process.exitCode = 1;
  }
};
