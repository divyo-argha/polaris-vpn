import chalk from 'chalk';
import { printSuccess, printError, createSpinner, printInfo } from '../utils/display.js';
import { deployServer } from '../core/deploy-service.js';
import startCommand from './start.js';

export default async (options) => {
  const isJson = options.json;
  const server = options.server;
  
  if (!server) {
    if (isJson) {
      console.log(JSON.stringify({ error: 'Missing --server argument' }));
    } else {
      printError('You must specify a server with --server <user@host>');
    }
    process.exitCode = 1;
    return;
  }

  const spinner = isJson ? null : createSpinner('Initiating server deployment...').start();

  try {
    const res = await deployServer(server, {
      privateKey: options.identity,
      password: options.password,
      onProgress: (msg) => {
        if (spinner) spinner.text = msg;
      }
    });

    if (spinner) {
      spinner.succeed('Server provisioning completed successfully!');
    }

    if (isJson) {
      console.log(JSON.stringify({ success: true, ...res }));
    } else {
      printSuccess(`WireGuard configured on remote VPS ${server}`);
      printInfo(`Local Client Config: ${res.clientConfPath}`);
      printInfo(`Client Public Key  : ${res.clientPublicKey}`);
      printInfo(`Server Public Key  : ${res.serverPublicKey}`);
      console.log(chalk.cyan('\nStarting WireGuard tunnel connection locally...\n'));
    }

    // Automatically trigger local connection
    await startCommand({ mode: 'wireguard', json: isJson });

  } catch (err) {
    if (spinner) spinner.fail('Deployment failed');
    if (isJson) {
      console.log(JSON.stringify({ error: err.message }));
    } else {
      printError('Deployment failed', err);
    }
    process.exitCode = 1;
  }
};
