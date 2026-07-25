import fs from 'fs';
import path from 'path';
import { CONFIG_DIR, ensureDir } from './config.js';

const LOG_FILE = path.join(CONFIG_DIR, 'events.log');
const MAX_LOG_LINES = 2000;

/**
 * Valid log event types.
 * @typedef {'CONNECT'|'DISCONNECT'|'DNS_START'|'DNS_STOP'|'KEY_ROTATE'|'ERROR'|'INFO'} LogType
 */

/**
 * Appends a structured JSON event line to the polaris events log.
 * @param {LogType} type
 * @param {string} message
 * @param {object} [meta]
 */
export const logEvent = (type, message, meta = {}) => {
  try {
    ensureDir();
    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      type,
      message,
      ...meta
    });
    fs.appendFileSync(LOG_FILE, entry + '\n', 'utf-8');

    // Trim log if it grows too large (keep last MAX_LOG_LINES lines)
    if (fs.existsSync(LOG_FILE)) {
      const content = fs.readFileSync(LOG_FILE, 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      if (lines.length > MAX_LOG_LINES) {
        fs.writeFileSync(LOG_FILE, lines.slice(-MAX_LOG_LINES).join('\n') + '\n', 'utf-8');
      }
    }
  } catch (_) {
    // Logging must never crash the process
  }
};

/**
 * Reads the last `limit` log entries from the events log.
 * @param {number} [limit=50]
 * @returns {Array<{ts: string, type: string, message: string}>}
 */
export const readLogs = (limit = 50) => {
  if (!fs.existsSync(LOG_FILE)) return [];
  try {
    const content = fs.readFileSync(LOG_FILE, 'utf-8');
    const lines = content.split('\n').filter(Boolean);
    const last = lines.slice(-limit);
    return last.map(line => {
      try { return JSON.parse(line); }
      catch (_) { return { ts: '', type: 'RAW', message: line }; }
    }).reverse(); // Most recent first
  } catch (_) {
    return [];
  }
};

/**
 * Returns the absolute path to the log file.
 */
export const getLogPath = () => LOG_FILE;
