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

test('measureTcpHandshake completes within the specified timeout window', async () => {
  const timeoutMs = 300;
  const start = Date.now();
  // Use TEST-NET-1 (192.0.2.x) — RFC 5737 reserved, guaranteed unreachable
  await measureTcpHandshake('192.0.2.2', 8080, timeoutMs);
  const elapsed = Date.now() - start;
  // Allow 500ms of overhead for socket cleanup
  assert.ok(
    elapsed < timeoutMs + 500,
    `measureTcpHandshake took ${elapsed}ms but should complete within ${timeoutMs + 500}ms`
  );
});

test('benchmarkServer returns a score for localhost', async () => {
  const { benchmarkServer } = await import('../src/core/benchmark-service.js');
  const result = await benchmarkServer('local', '127.0.0.1');
  assert.ok(typeof result.score === 'number', 'score should be a number');
  assert.ok(result.alias === 'local', 'alias should match input');
  assert.ok(result.host === '127.0.0.1', 'host should be extracted correctly');
});
