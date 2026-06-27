import chalk from 'chalk';
import { getTunnelInfo } from '../tunnel/ssh.js';
import { getPublicIp, getProxiedIp, checkDns, checkIpv6Leak } from '../net/ip.js';
import { createTable, createSpinner, printError } from '../ui/display.js';

export default async (options) => {
  const isJson = options.json;
  const info = getTunnelInfo();
  
  if (!isJson) {
    console.log(chalk.cyan.bold('\nRunning Privacy Check...\n'));
  }

  const spinner = isJson ? null : createSpinner('Running tests...').start();
  const results = { ip: null, dns: null, ipv6: null };
  const details = {};

  try {
    // 1. IP Check
    if (spinner) spinner.text = 'Checking IP address...';
    if (info) {
      try {
        const tunnelIp = await getProxiedIp(info.port);
        results.ip = true;
        details.ip = `Tunnel active: ${tunnelIp}`;
      } catch (e) {
        results.ip = false;
        details.ip = `Tunnel process running but proxy failed: ${e.message}`;
      }
    } else {
      const pubIp = await getPublicIp();
      results.ip = false;
      details.ip = `No tunnel active. Exposed IP: ${pubIp}`;
    }

    // 2. DNS Leak Check
    if (spinner) spinner.text = 'Checking DNS...';
    const dnsResult = await checkDns();
    if (!dnsResult.success) {
      results.dns = false;
      details.dns = 'DNS resolution failed';
    } else {
      // In a real full VPN this would check if it's our VPN's DNS.
      // Since this is just a SOCKS5 proxy, system DNS is usually used.
      // We flag it as warning/fail if it's likely an ISP DNS, but for MVP
      // we'll just check if we can resolve and list the servers used.
      const servers = dnsResult.servers.join(', ');
      // SOCKS5 doesn't automatically tunnel DNS for all OS commands, 
      // but browsers can be configured to use SOCKS5 for DNS.
      results.dns = true; 
      details.dns = `Using system DNS: ${servers}`;
    }

    // 3. IPv6 Leak Check
    if (spinner) spinner.text = 'Checking IPv6 leaks...';
    const ipv6 = await checkIpv6Leak();
    if (ipv6) {
      results.ipv6 = false;
      details.ipv6 = `IPv6 address detected: ${ipv6} (potential leak)`;
    } else {
      results.ipv6 = true;
      details.ipv6 = 'No IPv6 address detected';
    }

    if (spinner) spinner.stop();

    if (isJson) {
      console.log(JSON.stringify({ results, details }));
    } else {
      const table = createTable(['Check', 'Status', 'Details']);
      
      const formatResult = (pass) => pass ? chalk.green('✓ PASS') : chalk.red('✗ FAIL');
      
      table.push(
        ['IP Address', formatResult(results.ip), details.ip],
        // If dns is "pass" but we know it's a SOCKS proxy, it's actually a warning that DNS isn't tunneled OS-wide
        ['DNS Leak', results.dns ? chalk.yellow('⚠ WARN') : formatResult(results.dns), details.dns],
        ['IPv6 Leak', formatResult(results.ipv6), details.ipv6]
      );
      
      console.log(table.toString());
      console.log();
      
      if (!info) {
        console.log(chalk.yellow('Note: Your traffic is currently exposed. Run "polaris start" to connect.'));
      } else {
        console.log(chalk.cyan('Note: SOCKS5 proxies only tunnel apps configured to use them (like your browser).'));
        console.log(chalk.cyan('      System-wide DNS leaks are expected until v0.5 (WireGuard).'));
      }
      console.log();
    }
  } catch (err) {
    if (spinner) spinner.stop();
    if (isJson) {
      console.log(JSON.stringify({ error: err.message }));
    } else {
      printError('Failed to run privacy checks', err);
    }
    process.exitCode = 1;
  }
};
