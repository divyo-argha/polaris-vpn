import chalk from 'chalk';
import { runSpeedTest } from '../core/speedtest-service.js';
import { createSpinner, printBox, createTable } from '../utils/display.js';
import { handleError } from '../utils/error-handler.js';

export default async (options) => {
  const isJson = options.json;
  const spinner = isJson ? null : createSpinner('Initiating VPN speed test...').start();

  try {
    const results = await runSpeedTest((msg) => {
      if (spinner) spinner.text = msg;
    });

    if (spinner) spinner.stop();

    if (isJson) {
      console.log(JSON.stringify(results, null, 2));
    } else {
      const table = createTable(['Metric', 'Measurement']);
      table.push(
        ['Tunnel Mode', chalk.cyan(results.tunnelMode)],
        ['Connected Server', chalk.yellow(results.server)],
        ['Public IP', chalk.white(results.publicIp)],
        ['Latency (Ping)', `${chalk.green(results.pingMs)} ms`],
        ['Download Speed', `${chalk.green.bold(results.downloadSpeedMbps)} Mbps (${results.downloadSpeedMBps} MB/s)`],
        ['Streaming & Gaming', chalk.magenta.bold(results.rating)]
      );

      console.log(chalk.bold.cyan('\n  ⚡ Polaris VPN Speedtest Results\n'));
      console.log(table.toString());
      console.log();
    }
  } catch (err) {
    if (spinner) spinner.stop();
    handleError('Speed test failed', err, isJson);
  }
};
