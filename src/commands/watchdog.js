import chalk from 'chalk';
import { runWatchdogCheck, getWatchdogStatus } from '../core/watchdog-service.js';
import { printSuccess, printInfo, printError, createSpinner } from '../utils/display.js';
import { handleError } from '../utils/error-handler.js';

export const watchdogCheck = async (options) => {
  const isJson = options.json;
  const spinner = isJson ? null : createSpinner('Checking tunnel heartbeat...').start();

  try {
    const res = await runWatchdogCheck();
    if (spinner) spinner.stop();

    if (isJson) {
      console.log(JSON.stringify(res, null, 2));
    } else {
      if (res.healthy) {
        printSuccess('Tunnel is healthy and gateway (10.0.0.1) is responding.');
      } else {
        printError(`Tunnel health degraded: ${res.reason || res.status}`);
      }
    }
  } catch (err) {
    if (spinner) spinner.stop();
    handleError('Watchdog check failed', err, isJson);
  }
};

export const watchdogStatus = async (options) => {
  const isJson = options.json;
  const status = getWatchdogStatus();
  if (isJson) {
    console.log(JSON.stringify(status, null, 2));
  } else {
    printInfo(`Watchdog Active: ${status.running ? chalk.green('Yes') : chalk.gray('No')}`);
    printInfo(`Last Health Status: ${chalk.cyan(status.lastStatus)}`);
    if (status.lastCheckTime) {
      printInfo(`Last Checked: ${new Date(status.lastCheckTime).toLocaleTimeString()}`);
    }
  }
};
