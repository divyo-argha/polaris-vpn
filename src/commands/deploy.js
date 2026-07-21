import chalk from 'chalk';
import { createSpinner, printBox } from '../utils/display.js';
import { deployServer } from '../core/deploy-service.js';
import startCommand from './start.js';
import { handleError } from '../utils/error-handler.js';

export default async (options) => {
  const isJson = options.json;
  const server = options.server;
  
  if (!server) {
    handleError('You must specify a server with --server <user@host>', null, isJson);
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
      printBox('Server Provisioned Successfully 🚀', `Remote Server: ${server}\nLocal Config: ${res.clientConfPath}\nClient PK: ${res.clientPublicKey}\nServer PK: ${res.serverPublicKey}`, 'success');
      console.log(chalk.cyan('\nStarting WireGuard tunnel connection locally...\n'));
    }

    // Automatically trigger local connection
    const mode = options.mode || 'wireguard';
    await startCommand({ server, mode, json: isJson });

  } catch (err) {
    if (spinner) spinner.fail('Deployment failed');
    handleError('Deployment failed', err, isJson);
  }
};
