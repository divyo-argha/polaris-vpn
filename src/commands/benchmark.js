import chalk from 'chalk';
import { printInfo, createSpinner, createTable, printError } from '../utils/display.js';
import { benchmarkAllProfiles } from '../core/benchmark-service.js';

export default async (options) => {
  const isJson = options.json;
  const spinner = isJson ? null : createSpinner('Benchmarking saved server profiles...').start();

  try {
    const results = await benchmarkAllProfiles();
    if (spinner) spinner.stop();

    if (results.length === 0) {
      if (isJson) {
        console.log(JSON.stringify({ error: 'No saved profiles found' }));
      } else {
        printInfo('No saved server profiles found. Add profiles with "polaris add <alias> --server <user@host>".');
      }
      return;
    }

    if (isJson) {
      console.log(JSON.stringify({ results }));
      return;
    }

    console.log(chalk.cyan.bold('\n● Polaris Server Latency Rankings\n'));

    const table = createTable(['Rank', 'Alias', 'Server Host', 'Ping Latency', 'SSH (22)', 'TLS (8443)']);

    results.forEach((r, idx) => {
      const isTop = idx === 0 && r.score < 9999;
      table.push([
        isTop ? chalk.green.bold(`#${idx + 1} ★`) : `#${idx + 1}`,
        isTop ? chalk.green.bold(r.alias) : r.alias,
        r.server,
        r.ping === 'Timeout' ? chalk.red(r.ping) : chalk.green(r.ping),
        r.tcpSsh === 'Timeout' ? chalk.dim(r.tcpSsh) : chalk.cyan(r.tcpSsh),
        r.tcpTls === 'Timeout' ? chalk.dim(r.tcpTls) : chalk.yellow(r.tcpTls)
      ]);
    });

    console.log(table.toString());
    console.log('');
    if (results[0] && results[0].score < 9999) {
      console.log(chalk.green(`Fastest server: ${chalk.bold(results[0].alias)} (${results[0].ping})\n`));
    }
  } catch (err) {
    if (spinner) spinner.stop();
    printError('Benchmark failed', err);
    process.exitCode = 1;
  }
};
