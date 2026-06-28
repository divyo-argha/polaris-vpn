import chalk from 'chalk';
import { getTunnelInfo } from '../tunnel/ssh.js';
import { getPublicIp, getProxiedIp, checkDns, checkIpv6Leak } from '../net/ip.js';
import { getDnsStatus } from '../net/dns.js';
import { createTable, createSpinner, printError } from '../ui/display.js';

export default async (options) => {
  const isJson = options.json;
  const info = getTunnelInfo();
  const dnsStatus = getDnsStatus();
  
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
        details.ip = `Tunnel active (${(info.mode || 'ssh').toUpperCase()}): ${tunnelIp}`;
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
      if (dnsStatus) {
        results.dns = true;
        details.dns = `DoH Resolver Active: 127.0.0.1:${dnsStatus.port} (Upstream: ${dnsStatus.upstream})`;
      } else {
        const servers = dnsResult.servers.join(', ');
        results.dns = false; 
        details.dns = `Using system/ISP DNS: ${servers} (Potential DNS Leak)`;
      }
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
      console.log(JSON.stringify({
        results,
        details,
        tunnelMode: info ? (info.mode || 'ssh') : 'none',
        dnsResolver: dnsStatus ? 'doh' : 'system'
      }));
    } else {
      const table = createTable(['Check', 'Status', 'Details']);
      
      const formatResult = (pass) => pass ? chalk.green('✓ PASS') : chalk.red('✗ FAIL');
      
      table.push(
        ['IP Address', formatResult(results.ip), details.ip],
        ['DNS Leak', dnsStatus ? chalk.green('✓ PASS') : chalk.yellow('⚠ WARN'), details.dns],
        ['IPv6 Leak', formatResult(results.ipv6), details.ipv6],
        ['WebRTC Leak', chalk.cyan('ⓘ INFO'), 'WebRTC can bypass proxies. Check browserleaks.com/webrtc']
      );
      
      console.log(table.toString());
      console.log();
      
      if (!info) {
        console.log(chalk.yellow('Note: Your traffic is currently exposed. Run "polaris start" to connect.'));
      } else {
        console.log(chalk.cyan('Note: SOCKS5 proxies only tunnel apps configured to use them (like your browser).'));
        if (!dnsStatus) {
          console.log(chalk.yellow('      Run "polaris dns start" to prevent DNS queries from leaking to your ISP.'));
        }
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
