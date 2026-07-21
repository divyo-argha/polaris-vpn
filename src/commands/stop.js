import { stopActiveTunnel } from '../core/tunnel-service.js';
import { stopDnsResolver } from '../core/dns-service.js';
import { restoreSystemDns } from '../net/system-dns.js';
import { printSuccess, printInfo, printError } from '../utils/display.js';

export default async (options) => {
  const isJson = options.json;
  
  try {
    const info = stopActiveTunnel(isJson);

    // Restore system DNS and stop DoH resolver
    restoreSystemDns();
    stopDnsResolver();

    if (!info) {
      if (isJson) {
        console.log(JSON.stringify({ success: true, message: 'No active tunnel found.' }));
      } else {
        printInfo('No active tunnel found.');
      }
      return;
    }
    
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
