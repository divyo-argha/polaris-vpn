import { createSpinner, printSuccess, printInfo, printError, printBox } from '../utils/display.js';
import { rotateKeys, getRotationConfig, setRotationConfig } from '../core/key-rotation-service.js';

export default async (options) => {
  const isJson = options.json;

  // Handle --schedule flag: save schedule and exit
  if (options.schedule !== undefined) {
    const days = parseInt(options.schedule, 10);
    if (isNaN(days) || days < 1) {
      if (isJson) {
        console.log(JSON.stringify({ error: '--schedule must be a positive number of days' }));
      } else {
        printError('--schedule must be a positive number of days (e.g. --schedule 30)');
      }
      process.exitCode = 1;
      return;
    }
    setRotationConfig({ intervalDays: days });
    if (isJson) {
      console.log(JSON.stringify({ success: true, intervalDays: days }));
    } else {
      printSuccess(`Key rotation scheduled every ${days} day(s). Will auto-rotate at next "polaris start".`);
    }
    return;
  }

  // Show current schedule if --status
  if (options.status) {
    const { intervalDays, lastRotated } = getRotationConfig();
    if (isJson) {
      console.log(JSON.stringify({ intervalDays, lastRotated }));
    } else {
      printBox('Key Rotation Status', [
        `Schedule: ${intervalDays ? `Every ${intervalDays} day(s)` : 'Not configured (manual only)'}`,
        `Last rotated: ${lastRotated ? new Date(lastRotated).toLocaleString() : 'Never'}`
      ].join('\n'), 'info');
    }
    return;
  }

  // Perform rotation
  if (!isJson) printInfo('Starting WireGuard key rotation...');

  const spinner = isJson ? null : createSpinner('Connecting to server...').start();

  try {
    const result = await rotateKeys({
      onProgress: (msg) => {
        if (spinner) spinner.text = msg;
      }
    });

    if (spinner) spinner.stop();

    if (isJson) {
      console.log(JSON.stringify({
        success: true,
        newPublicKey: result.newPublicKey,
        confPath: result.confPath,
        message: 'Keys rotated successfully. Reconnect with "polaris stop && polaris start".'
      }));
    } else {
      printBox(
        '🔑 Key Rotation Complete',
        [
          `New Public Key: ${result.newPublicKey}`,
          `Config saved to: ${result.confPath}`,
          '',
          'Reconnect to activate new keys:',
          '  polaris stop && polaris start'
        ].join('\n'),
        'success'
      );
    }
  } catch (err) {
    if (spinner) spinner.stop();
    if (isJson) {
      console.log(JSON.stringify({ error: err.message }));
    } else {
      printError('Key rotation failed', err);
    }
    process.exitCode = 1;
  }
};
