import test from 'node:test';
import assert from 'node:assert';
import { generateKeyPair, generateAwgParams } from '../src/tunnel/wg.js';

test('generateKeyPair creates valid base64 keys', () => {
  const keys = generateKeyPair();
  
  assert.ok(keys.privateKey);
  assert.ok(keys.publicKey);
  
  // WireGuard keys are 32 bytes, which means base64 is 44 chars
  assert.strictEqual(keys.privateKey.length, 44);
  assert.strictEqual(keys.publicKey.length, 44);
  assert.ok(keys.privateKey.endsWith('='));
  assert.ok(keys.publicKey.endsWith('='));
});

test('generateAwgParams creates required parameters', () => {
  const params = generateAwgParams();
  
  assert.ok(params.Jc >= 1 && params.Jc <= 100);
  assert.ok(params.Jmin >= 1 && params.Jmin <= 50);
  assert.ok(params.Jmax >= 50 && params.Jmax <= 1000);
  assert.ok(params.S1 >= 15 && params.S1 <= 150);
  assert.ok(params.S2 >= 15 && params.S2 <= 150);
  assert.ok(params.H1 >= 1 && params.H1 <= 2147483647);
  assert.ok(params.H2 >= 1 && params.H2 <= 2147483647);
  assert.ok(params.H3 >= 1 && params.H3 <= 2147483647);
  assert.ok(params.H4 >= 1 && params.H4 <= 2147483647);
});
