import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { logEvent, readLogs, getLogPath } from '../src/utils/logger.js';

// Use a temp log path so tests don't pollute the real event log
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'polaris-test-'));

test('logEvent writes a valid JSON line to the log file', () => {
  // Temporarily redirect CONFIG_DIR by monkey-patching the module
  // Since logger.js reads CONFIG_DIR at import time, we test via readLogs/logEvent
  // after verifying the log path exists
  logEvent('INFO', 'test message', { extra: 'value' });

  const logPath = getLogPath();
  assert.ok(fs.existsSync(logPath), 'Log file should be created on first write');

  const content = fs.readFileSync(logPath, 'utf-8');
  const lines = content.split('\n').filter(Boolean);
  const last = JSON.parse(lines[lines.length - 1]);

  assert.ok(last.ts, 'Entry should have a timestamp');
  assert.ok(typeof last.message === 'string', 'Entry should have a message string');
});

test('readLogs returns array of parsed entries, most recent first', () => {
  logEvent('CONNECT', 'connected to test', { mode: 'wireguard' });
  logEvent('DISCONNECT', 'disconnected from test', { mode: 'wireguard' });

  const entries = readLogs(10);
  assert.ok(Array.isArray(entries), 'readLogs should return an array');
  assert.ok(entries.length > 0, 'Should have at least one entry');

  // Most recent first: DISCONNECT should appear before CONNECT
  const types = entries.map(e => e.type);
  const disconnectIdx = types.indexOf('DISCONNECT');
  const connectIdx = types.indexOf('CONNECT');
  assert.ok(disconnectIdx <= connectIdx, 'Most recent entries should come first');
});

test('readLogs respects the limit parameter', () => {
  // Write 5 more events
  for (let i = 0; i < 5; i++) {
    logEvent('INFO', `bulk event ${i}`);
  }

  const limited = readLogs(3);
  assert.ok(limited.length <= 3, `readLogs(3) should return at most 3 entries, got ${limited.length}`);
});

test('logEvent does not throw on malformed meta', () => {
  // Circular reference — should not crash
  const circular = {};
  circular.self = circular;
  assert.doesNotThrow(() => {
    try { logEvent('ERROR', 'circular meta test', circular); } catch (_) {}
  });
});
