import test from 'node:test';
import assert from 'node:assert';
import { getBypassRules, addBypassRule, removeBypassRule, clearBypassRules } from '../src/utils/bypass.js';

test('bypass rules can be added, listed, and removed', () => {
  try { removeBypassRule('netflix.com'); } catch (e) {}
  const initial = getBypassRules();
  
  addBypassRule('netflix.com');
  let current = getBypassRules();
  assert.ok(current.includes('netflix.com'));

  assert.throws(() => {
    addBypassRule('netflix.com');
  }, /already exists/);

  removeBypassRule('netflix.com');
  current = getBypassRules();
  assert.strictEqual(current.includes('netflix.com'), false);
});

test('clearBypassRules executes without throwing', async () => {
  await assert.doesNotReject(async () => {
    await clearBypassRules();
  });
});
