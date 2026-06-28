import chalk from 'chalk';
import { printError, printSuccess, printInfo, printWarning } from '../ui/display.js';
import { startDnsBackground, stopDnsServer, getDnsStatus } from '../net/dns.js';

export const dnsStart = async (options) => {
  const port = parseInt(options.port || '5353', 10);
  const upstreamMap = {
    'cloudflare': 'https://cloudflare-dns.com/dns-query',
    'google': 'https://dns.google/resolve'
  };
  
  const provider = options.upstream || 'cloudflare';
  const upstream = upstreamMap[provider.toLowerCase()] || provider;
  const isJson = options.json;

  try {
    const pid = startDnsBackground(port, upstream);
    if (isJson) {
      console.log(JSON.stringify({ success: true, pid, port, upstream }));
    } else {
      printSuccess(`DNS-over-HTTPS resolver started on 127.0.0.1:${port}`);
      printInfo(`Forwarding to: ${upstream}`);
    }
  } catch (err) {
    if (isJson) {
      console.log(JSON.stringify({ error: err.message }));
    } else {
      printError('Failed to start DNS resolver', err);
    }
    process.exitCode = 1;
  }
};

export const dnsStop = async (options) => {
  const isJson = options.json;
  const status = getDnsStatus();

  if (!status) {
    if (isJson) {
      console.log(JSON.stringify({ error: 'DNS resolver is not running' }));
    } else {
      printWarning('DNS resolver is not running.');
    }
    return;
  }

  try {
    stopDnsServer();
    if (isJson) {
      console.log(JSON.stringify({ success: true }));
    } else {
      printSuccess('DNS-over-HTTPS resolver stopped.');
    }
  } catch (err) {
    if (isJson) {
      console.log(JSON.stringify({ error: err.message }));
    } else {
      printError('Failed to stop DNS resolver', err);
    }
    process.exitCode = 1;
  }
};

export const dnsStatus = async (options) => {
  const isJson = options.json;
  const status = getDnsStatus();

  if (!status) {
    if (isJson) {
      console.log(JSON.stringify({ running: false }));
    } else {
      console.log(`${chalk.red('✗')} DNS Resolver: ${chalk.red('Stopped')}`);
    }
    return;
  }

  if (isJson) {
    console.log(JSON.stringify({ running: true, ...status }));
  } else {
    console.log(`${chalk.green('✓')} DNS Resolver: ${chalk.green('Running')}`);
    console.log(`  ${chalk.dim('PID     :')} ${status.pid}`);
    console.log(`  ${chalk.dim('Port    :')} ${status.port}`);
    console.log(`  ${chalk.dim('Upstream:')} ${status.upstream}`);
    console.log(`  ${chalk.dim('Uptime  :')} ${Math.floor((Date.now() - new Date(status.startTime)) / 1000)}s`);
  }
};
