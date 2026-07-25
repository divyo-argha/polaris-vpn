import test from 'node:test';
import assert from 'node:assert';
import {
  getProfiles,
  addProfile,
  setActiveProfile,
  addTagToProfile,
  removeTagFromProfile,
  getProfilesByTag
} from '../src/core/profile-service.js';

test('profile service correctly saves and returns profiles', () => {
  addProfile('test-server', 'user@1.2.3.4');
  const { profiles, active } = getProfiles();

  assert.ok(profiles['test-server'], 'Profile should exist');
  assert.strictEqual(profiles['test-server'].server, 'user@1.2.3.4');
  assert.ok(Array.isArray(profiles['test-server'].tags), 'Tags should be an array');

  const res = setActiveProfile('test-server');
  assert.strictEqual(res.alias, 'test-server');
  assert.strictEqual(res.server, 'user@1.2.3.4');
});

test('setActiveProfile throws for unknown alias', () => {
  assert.throws(() => {
    setActiveProfile('nonexistent-alias-xyz');
  }, /not found/i);
});

test('addProfile stores initial tags', () => {
  addProfile('tagged-server', 'user@5.6.7.8', ['streaming', 'eu']);
  const { profiles } = getProfiles();
  assert.ok(profiles['tagged-server'].tags.includes('streaming'), 'Should have streaming tag');
  assert.ok(profiles['tagged-server'].tags.includes('eu'), 'Should have eu tag');
});

test('addTagToProfile and removeTagFromProfile manage tags correctly', () => {
  addProfile('tag-test-server', 'user@9.10.11.12', []);

  addTagToProfile('tag-test-server', 'work');
  let { profiles } = getProfiles();
  assert.ok(profiles['tag-test-server'].tags.includes('work'), 'work tag should be added');

  // Adding the same tag again should not duplicate it
  addTagToProfile('tag-test-server', 'work');
  ({ profiles } = getProfiles());
  const workCount = profiles['tag-test-server'].tags.filter(t => t === 'work').length;
  assert.strictEqual(workCount, 1, 'Duplicate tags should not be stored');

  removeTagFromProfile('tag-test-server', 'work');
  ({ profiles } = getProfiles());
  assert.ok(!profiles['tag-test-server'].tags.includes('work'), 'work tag should be removed');
});

test('getProfilesByTag returns only profiles with the given tag', () => {
  addProfile('stream-us', 'user@1.1.1.1', ['streaming', 'us']);
  addProfile('stream-eu', 'user@2.2.2.2', ['streaming', 'eu']);
  addProfile('work-server', 'user@3.3.3.3', ['work']);

  const streamingProfiles = getProfilesByTag('streaming');
  const aliases = streamingProfiles.map(p => p.alias);

  assert.ok(aliases.includes('stream-us'), 'stream-us should be in streaming results');
  assert.ok(aliases.includes('stream-eu'), 'stream-eu should be in streaming results');
  assert.ok(!aliases.includes('work-server'), 'work-server should not be in streaming results');
});

test('getProfilesByTag returns empty array for unknown tag', () => {
  const results = getProfilesByTag('nonexistent-tag-xyz');
  assert.ok(Array.isArray(results), 'Should return an array');
  assert.strictEqual(results.filter(p => !['stream-us', 'stream-eu', 'work-server'].includes(p.alias)).length, 0);
});
