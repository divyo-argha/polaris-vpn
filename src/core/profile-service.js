import { store } from '../utils/config.js';

export const addProfile = (alias, server) => {
  if (!server) {
    throw new Error('Server address is required');
  }
  const profiles = store.get('servers', {});
  profiles[alias] = server;
  store.set('servers', profiles);
  
  if (!store.get('activeServer')) {
    store.set('activeServer', alias);
  }
  return { alias, server };
};

export const getProfiles = () => {
  const profiles = store.get('servers', {});
  const active = store.get('activeServer');
  return { profiles, active };
};

export const setActiveProfile = (alias) => {
  const profiles = store.get('servers', {});
  if (!profiles[alias]) {
    throw new Error(`Profile '${alias}' not found`);
  }
  store.set('activeServer', alias);
  return { alias, server: profiles[alias] };
};
