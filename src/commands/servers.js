import chalk from 'chalk';
import { printSuccess, printError, printInfo, createTable } from '../utils/display.js';
import { addProfile, getProfiles, setActiveProfile, addTagToProfile, removeTagFromProfile } from '../core/profile-service.js';

export const addServer = async (alias, options) => {
  const isJson = options.json;
  const server = options.server;

  if (!server) {
    if (isJson) {
      console.log(JSON.stringify({ error: 'Missing --server argument' }));
    } else {
      printError('You must provide a server with --server <user@host>');
    }
    process.exitCode = 1;
    return;
  }

  try {
    const tags = options.tag ? [options.tag] : [];
    const res = addProfile(alias, server, tags);
    if (isJson) {
      console.log(JSON.stringify({ success: true, ...res }));
    } else {
      const tagStr = res.tags.length > 0 ? ` [${res.tags.join(', ')}]` : '';
      printSuccess(`Saved profile '${alias}' → ${server}${tagStr}`);
    }
  } catch (err) {
    if (isJson) {
      console.log(JSON.stringify({ error: err.message }));
    } else {
      printError('Failed to add profile', err);
    }
    process.exitCode = 1;
  }
};

export const listServers = async (options) => {
  const isJson = options.json;
  const { profiles, active } = getProfiles();
  const aliases = Object.keys(profiles);

  if (isJson) {
    console.log(JSON.stringify({ servers: profiles, active }));
    return;
  }

  if (aliases.length === 0) {
    printInfo('No server profiles saved yet. Use "polaris add <alias> --server <user@host>".');
    return;
  }

  const table = createTable(['Alias', 'Server', 'Tags', 'Active']);

  for (const alias of aliases) {
    const isActive = alias === active;
    const { server, tags } = profiles[alias];
    table.push([
      isActive ? chalk.green.bold(alias) : alias,
      server,
      tags && tags.length > 0 ? chalk.cyan(tags.join(', ')) : chalk.dim('—'),
      isActive ? chalk.green('★') : ''
    ]);
  }

  console.log('\n' + table.toString() + '\n');
};

export const useServer = async (alias, options) => {
  const isJson = options.json;

  try {
    const res = setActiveProfile(alias);
    if (isJson) {
      console.log(JSON.stringify({ success: true, active: alias, server: res.server }));
    } else {
      printSuccess(`Set '${alias}' as the active profile.`);
    }
  } catch (err) {
    if (isJson) {
      console.log(JSON.stringify({ error: err.message }));
    } else {
      printError(err.message);
    }
    process.exitCode = 1;
  }
};

export const tagServer = async (alias, tag, options) => {
  const isJson = options.json;
  const remove = options.remove;

  try {
    const res = remove
      ? removeTagFromProfile(alias, tag)
      : addTagToProfile(alias, tag);

    if (isJson) {
      console.log(JSON.stringify({ success: true, alias, tags: res.tags }));
    } else {
      if (remove) {
        printSuccess(`Removed tag '${tag}' from '${alias}'.`);
      } else {
        printSuccess(`Tagged '${alias}' with '${tag}'. Tags: ${res.tags.join(', ')}`);
      }
    }
  } catch (err) {
    if (isJson) {
      console.log(JSON.stringify({ error: err.message }));
    } else {
      printError(err.message);
    }
    process.exitCode = 1;
  }
};
