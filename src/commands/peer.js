import fs from 'fs';
import chalk from 'chalk';
import qrcode from 'qrcode-terminal';
import { printSuccess, printError, createSpinner, printInfo, createTable } from '../utils/display.js';
import { addPeer, listPeers, removePeer, getLocalPeerConfPath } from '../core/peer-service.js';

export const peerAdd = async (name, options) => {
  const isJson = options.json;
  const spinner = isJson ? null : createSpinner(`Creating peer '${name}' on server...`).start();

  try {
    const res = await addPeer(name);
    if (spinner) spinner.succeed(`Peer '${name}' created successfully!`);

    if (isJson) {
      console.log(JSON.stringify({ success: true, ...res }));
    } else {
      printSuccess(`Saved local peer profile: ${res.confPath}`);
      printInfo(`IP Assigned: ${res.ip}`);
      printInfo(`Public Key : ${res.publicKey}`);
      console.log(chalk.cyan('\nScan this QR code with the WireGuard app on your mobile device:\n'));
      
      const confString = fs.readFileSync(res.confPath, 'utf-8');
      qrcode.generate(confString, { small: true });
    }
  } catch (err) {
    if (spinner) spinner.fail('Failed to add peer');
    if (isJson) {
      console.log(JSON.stringify({ error: err.message }));
    } else {
      printError('Failed to add peer', err);
    }
    process.exitCode = 1;
  }
};

export const peerList = async (options) => {
  const isJson = options.json;
  const spinner = isJson ? null : createSpinner('Fetching peer list...').start();

  try {
    const peers = await listPeers();
    if (spinner) spinner.stop();

    if (isJson) {
      console.log(JSON.stringify({ success: true, peers }));
      return;
    }

    if (peers.length === 0) {
      printInfo('No peers configured on server.');
      return;
    }

    const table = createTable(['Name', 'Assigned IP', 'Latest Handshake', 'Transfer Received/Sent']);
    
    for (const p of peers) {
      table.push([
        chalk.green.bold(p.name),
        p.ip,
        p.handshake,
        `${p.transferRx} / ${p.transferTx}`
      ]);
    }

    console.log('\n' + table.toString() + '\n');
  } catch (err) {
    if (spinner) spinner.stop();
    if (isJson) {
      console.log(JSON.stringify({ error: err.message }));
    } else {
      printError('Failed to list peers', err);
    }
    process.exitCode = 1;
  }
};

export const peerRemove = async (name, options) => {
  const isJson = options.json;
  const spinner = isJson ? null : createSpinner(`Revoking peer '${name}'...`).start();

  try {
    await removePeer(name);
    if (spinner) spinner.succeed(`Peer '${name}' revoked from server.`);

    if (isJson) {
      console.log(JSON.stringify({ success: true }));
    }
  } catch (err) {
    if (spinner) spinner.fail('Failed to remove peer');
    if (isJson) {
      console.log(JSON.stringify({ error: err.message }));
    } else {
      printError('Failed to remove peer', err);
    }
    process.exitCode = 1;
  }
};

export const peerQr = async (name, options) => {
  const isJson = options.json;

  try {
    const confPath = getLocalPeerConfPath(name);
    const confString = fs.readFileSync(confPath, 'utf-8');

    if (isJson) {
      console.log(JSON.stringify({ success: true, config: confString }));
    } else {
      console.log(chalk.cyan(`\nQR code for peer configuration '${name}':\n`));
      qrcode.generate(confString, { small: true });
    }
  } catch (err) {
    if (isJson) {
      console.log(JSON.stringify({ error: err.message }));
    } else {
      printError('Failed to retrieve QR code', err);
    }
    process.exitCode = 1;
  }
};
