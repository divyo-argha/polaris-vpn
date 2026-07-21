import test from 'node:test';
import assert from 'node:assert';
import { getProfiles, addProfile, setActiveProfile } from '../src/core/profile-service.js';

test('profile service correctly saves and returns profiles', () => {
  addProfile('test-server', 'user@1.2.3.4');
  const { profiles, active } = getProfiles();
  
  assert.ok(profiles['test-server']);
  assert.strictEqual(profiles['test-server'], 'user@1.2.3.4');
  assert.strictEqual(active, 'test-server');

  const res = setActiveProfile('test-server');
  assert.strictEqual(res.alias, 'test-server');
  assert.strictEqual(res.server, 'user@1.2.3.4');
});
