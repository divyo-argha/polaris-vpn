import test from 'node:test';
import assert from 'node:assert';
import { getRotationConfig, setRotationConfig, isRotationDue } from '../src/core/key-rotation-service.js';
import { generateKeyPair } from '../src/tunnel/wg.js';

test('getRotationConfig returns defaults when nothing is set', () => {
  const config = getRotationConfig();
  assert.ok(typeof config.intervalDays === 'number', 'intervalDays should be a number');
  // lastRotated is either null or a string
  assert.ok(config.lastRotated === null || typeof config.lastRotated === 'string',
    'lastRotated should be null or a string');
});

test('setRotationConfig persists intervalDays and lastRotated', () => {
  setRotationConfig({ intervalDays: 14, lastRotated: '2020-01-01T00:00:00.000Z' });
  const config = getRotationConfig();
  assert.strictEqual(config.intervalDays, 14);
  assert.strictEqual(config.lastRotated, '2020-01-01T00:00:00.000Z');

  // Cleanup
  setRotationConfig({ intervalDays: 0, lastRotated: null });
});

test('isRotationDue returns false when no schedule is configured', () => {
  setRotationConfig({ intervalDays: 0, lastRotated: null });
  assert.strictEqual(isRotationDue(), false);
});

test('isRotationDue returns true when lastRotated exceeds interval', () => {
  // Set last rotation to 60 days ago with a 30 day interval
  const sixtyDaysAgo = new Date(Date.now() - 60 * 86_400_000).toISOString();
  setRotationConfig({ intervalDays: 30, lastRotated: sixtyDaysAgo });
  assert.strictEqual(isRotationDue(), true);

  // Cleanup
  setRotationConfig({ intervalDays: 0, lastRotated: null });
});

test('isRotationDue returns false when rotation was recent', () => {
  const yesterday = new Date(Date.now() - 86_400_000).toISOString();
  setRotationConfig({ intervalDays: 30, lastRotated: yesterday });
  assert.strictEqual(isRotationDue(), false);

  // Cleanup
  setRotationConfig({ intervalDays: 0, lastRotated: null });
});

test('rotateKeys generates a distinct keypair each call (unit-level)', () => {
  // Without SSH, we just verify generateKeyPair (the core of rotateKeys) produces unique keys
  const k1 = generateKeyPair();
  const k2 = generateKeyPair();
  assert.notStrictEqual(k1.privateKey, k2.privateKey, 'Each keypair should be unique');
  assert.notStrictEqual(k1.publicKey, k2.publicKey, 'Public keys should differ');
});
