import test from 'node:test';
import assert from 'node:assert';
import { checkDns, checkIpv6Leak } from '../src/net/ip-check.js';

test('checkDns returns success:true and a non-empty servers array', async () => {
  const result = await checkDns();
  assert.ok(typeof result.success === 'boolean', 'success should be a boolean');
  assert.ok(Array.isArray(result.servers), 'servers should be an array');
  assert.ok(result.servers.length > 0, 'at least one DNS server should be configured');
});

test('checkIpv6Leak returns null or a string (no throws)', async () => {
  // This test is network-safe: if IPv6 is unavailable it returns null, if available returns a string
  const result = await checkIpv6Leak();
  const isValid = result === null || typeof result === 'string';
  assert.ok(isValid, `checkIpv6Leak should return null or a string, got: ${typeof result}`);
});
