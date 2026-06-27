import { stopTunnel, getTunnelInfo } from '../tunnel/ssh.js';
import { printSuccess, printInfo, printError } from '../ui/display.js';

export default async (options) => {
  const isJson = options.json;
  const info = getTunnelInfo();
  
  if (!info) {
    if (isJson) {
      console.log(JSON.stringify({ success: true, message: 'No active tunnel found.' }));
    } else {
      printInfo('No active tunnel found.');
    }
    return;
  }
  
  try {
    stopTunnel();
    if (isJson) {
      console.log(JSON.stringify({ success: true, message: 'Tunnel stopped successfully.' }));
    } else {
      printSuccess('Tunnel stopped successfully.');
    }
  } catch (err) {
    if (isJson) {
      console.log(JSON.stringify({ error: err.message }));
    } else {
      printError('Error stopping tunnel', err);
    }
    process.exitCode = 1;
  }
};
