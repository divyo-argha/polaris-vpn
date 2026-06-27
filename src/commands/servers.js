import Conf from 'conf';
import { printSuccess, printError, printInfo, createTable } from '../ui/display.js';
import chalk from 'chalk';

const config = new Conf({ projectName: 'polaris' });

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
  
  const profiles = config.get('servers', {});
  profiles[alias] = server;
  config.set('servers', profiles);
  
  // Auto-set as active if it's the first one
  if (!config.get('activeServer')) {
    config.set('activeServer', alias);
  }
  
  if (isJson) {
    console.log(JSON.stringify({ success: true, alias, server }));
  } else {
    printSuccess(`Saved profile '${alias}' -> ${server}`);
  }
};

export const listServers = async (options) => {
  const isJson = options.json;
  const profiles = config.get('servers', {});
  const activeAlias = config.get('activeServer');
  
  const aliases = Object.keys(profiles);
  
  if (isJson) {
    console.log(JSON.stringify({ servers: profiles, active: activeAlias }));
    return;
  }
  
  if (aliases.length === 0) {
    printInfo('No server profiles saved yet. Use "polaris add <alias> --server <user@host>".');
    return;
  }
  
  const table = createTable(['Alias', 'Server', 'Active']);
  
  for (const alias of aliases) {
    const isActive = alias === activeAlias;
    table.push([
      isActive ? chalk.green.bold(alias) : alias,
      profiles[alias],
      isActive ? chalk.green('★') : ''
    ]);
  }
  
  console.log('\n' + table.toString() + '\n');
};

export const useServer = async (alias, options) => {
  const isJson = options.json;
  const profiles = config.get('servers', {});
  
  if (!profiles[alias]) {
    if (isJson) {
      console.log(JSON.stringify({ error: `Profile '${alias}' not found` }));
    } else {
      printError(`Profile '${alias}' not found. Run "polaris list" to see saved profiles.`);
    }
    process.exitCode = 1;
    return;
  }
  
  config.set('activeServer', alias);
  
  if (isJson) {
    console.log(JSON.stringify({ success: true, active: alias, server: profiles[alias] }));
  } else {
    printSuccess(`Set '${alias}' as the active profile.`);
  }
};
