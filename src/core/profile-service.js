import { store } from '../utils/config.js';

// ─── Profile CRUD ────────────────────────────────────────────────────────────

/**
 * Adds or updates a server profile.
 * @param {string} alias
 * @param {string} server
 * @param {string[]} [tags]
 */
export const addProfile = (alias, server, tags = []) => {
  if (!server) {
    throw new Error('Server address is required');
  }
  const profiles = store.get('servers', {});
  // Preserve existing tags if not provided
  const existingTags = profiles[alias]?.tags || [];
  profiles[alias] = { server, tags: tags.length > 0 ? tags : existingTags };
  store.set('servers', profiles);

  if (!store.get('activeServer')) {
    store.set('activeServer', alias);
  }
  return { alias, server, tags: profiles[alias].tags };
};

/**
 * Returns all profiles and the active alias.
 * Profiles are keyed by alias → { server, tags }.
 * For backward compatibility, if a profile was stored as a plain string it is
 * normalised to { server, tags: [] } on first access.
 */
export const getProfiles = () => {
  const raw = store.get('servers', {});
  const profiles = {};
  for (const [alias, value] of Object.entries(raw)) {
    if (typeof value === 'string') {
      // Legacy plain-string format
      profiles[alias] = { server: value, tags: [] };
    } else {
      profiles[alias] = { server: value.server, tags: value.tags || [] };
    }
  }
  const active = store.get('activeServer');
  return { profiles, active };
};

/**
 * Returns the server string for an alias (for backward-compat callers).
 */
export const getServerString = (alias) => {
  const { profiles } = getProfiles();
  return profiles[alias]?.server || null;
};

export const setActiveProfile = (alias) => {
  const { profiles } = getProfiles();
  if (!profiles[alias]) {
    throw new Error(`Profile '${alias}' not found`);
  }
  store.set('activeServer', alias);
  return { alias, server: profiles[alias].server };
};

// ─── Tag Management ──────────────────────────────────────────────────────────

/**
 * Adds a tag to an existing profile.
 */
export const addTagToProfile = (alias, tag) => {
  const { profiles } = getProfiles();
  if (!profiles[alias]) throw new Error(`Profile '${alias}' not found`);
  const raw = store.get('servers', {});
  const entry = typeof raw[alias] === 'string'
    ? { server: raw[alias], tags: [] }
    : raw[alias];

  if (!entry.tags.includes(tag)) {
    entry.tags.push(tag);
  }
  raw[alias] = entry;
  store.set('servers', raw);
  return { alias, tags: entry.tags };
};

/**
 * Removes a tag from an existing profile.
 */
export const removeTagFromProfile = (alias, tag) => {
  const raw = store.get('servers', {});
  if (!raw[alias]) throw new Error(`Profile '${alias}' not found`);
  const entry = typeof raw[alias] === 'string'
    ? { server: raw[alias], tags: [] }
    : raw[alias];

  entry.tags = (entry.tags || []).filter(t => t !== tag);
  raw[alias] = entry;
  store.set('servers', raw);
  return { alias, tags: entry.tags };
};

/**
 * Returns all profiles that have the given tag.
 * @returns {Array<{ alias: string, server: string, tags: string[] }>}
 */
export const getProfilesByTag = (tag) => {
  const { profiles } = getProfiles();
  return Object.entries(profiles)
    .filter(([, v]) => v.tags && v.tags.includes(tag))
    .map(([alias, v]) => ({ alias, server: v.server, tags: v.tags }));
};

// ─── Key Rotation Schedule ───────────────────────────────────────────────────

export const getRotationConfig = () => ({
  intervalDays: store.get('rotation.intervalDays', 0),
  lastRotated: store.get('rotation.lastRotated', null)
});

export const setRotationConfig = (config) => {
  if (typeof config.intervalDays === 'number') {
    store.set('rotation.intervalDays', config.intervalDays);
  }
  if (config.lastRotated !== undefined) {
    store.set('rotation.lastRotated', config.lastRotated);
  }
};
