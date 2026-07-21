import test from 'node:test';
import assert from 'node:assert';
import { measurePing, measureTcpHandshake } from '../src/core/benchmark-service.js';

test('measurePing returns number or null for invalid host', () => {
  const ping = measurePing('127.0.0.1');
  assert.ok(ping === null || typeof ping === 'number');
});

test('measureTcpHandshake handles unreachable host gracefully', async () => {
  const res = await measureTcpHandshake('192.0.2.1', 9999, 100);
  assert.strictEqual(res, null);
});
