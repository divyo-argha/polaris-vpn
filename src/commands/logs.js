import fs from 'fs';
import chalk from 'chalk';
import { readLogs, getLogPath } from '../utils/logger.js';
import { createTable, printInfo } from '../utils/display.js';

const TYPE_COLORS = {
  CONNECT:    chalk.green,
  DISCONNECT: chalk.red,
  DNS_START:  chalk.cyan,
  DNS_STOP:   chalk.yellow,
  KEY_ROTATE: chalk.magenta,
  ERROR:      chalk.red.bold,
  INFO:       chalk.dim
};

const formatType = (type) => {
  const color = TYPE_COLORS[type] || chalk.white;
  return color(type.padEnd(12));
};

const formatTs = (ts) => {
  if (!ts) return chalk.dim('—');
  try {
    const d = new Date(ts);
    return chalk.dim(
      `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`
    );
  } catch (_) {
    return chalk.dim(ts);
  }
};

export default async (options) => {
  const isJson = options.json;
  const limit = parseInt(options.limit || '50', 10);
  const tail = options.tail;

  if (tail) {
    // Stream mode: watch log file for new appends
    const logPath = getLogPath();
    if (!isJson) {
      printInfo(`Tailing ${logPath} (Ctrl+C to stop)...\n`);
    }

    let lastSize = 0;
    try {
      if (fs.existsSync(logPath)) {
        lastSize = fs.statSync(logPath).size;
      }
    } catch (_) {}

    const watcher = fs.watch(logPath, { persistent: true }, (event) => {
      if (event !== 'change') return;
      try {
        const stat = fs.statSync(logPath);
        if (stat.size <= lastSize) return;
        const buf = Buffer.alloc(stat.size - lastSize);
        const fd = fs.openSync(logPath, 'r');
        fs.readSync(fd, buf, 0, buf.length, lastSize);
        fs.closeSync(fd);
        lastSize = stat.size;

        const lines = buf.toString('utf-8').split('\n').filter(Boolean);
        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            if (isJson) {
              console.log(JSON.stringify(entry));
            } else {
              console.log(`${formatTs(entry.ts)} ${formatType(entry.type)} ${entry.message}`);
            }
          } catch (_) {
            if (!isJson) console.log(chalk.dim(line));
          }
        }
      } catch (_) {}
    });

    // Keep process alive
    process.on('SIGINT', () => {
      watcher.close();
      process.exit(0);
    });
    return;
  }

  // Standard read mode
  const entries = readLogs(limit);

  if (isJson) {
    console.log(JSON.stringify(entries));
    return;
  }

  if (entries.length === 0) {
    printInfo('No log events found. Events are recorded when you connect, disconnect, or rotate keys.');
    return;
  }

  const table = createTable(['Time', 'Type', 'Message']);

  for (const entry of entries) {
    const extra = Object.entries(entry)
      .filter(([k]) => !['ts', 'type', 'message'].includes(k))
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');

    table.push([
      formatTs(entry.ts),
      formatType(entry.type),
      entry.message + (extra ? chalk.dim(`  [${extra}]`) : '')
    ]);
  }

  console.log('\n' + table.toString() + '\n');
};
