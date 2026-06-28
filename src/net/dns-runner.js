import { startDnsServerInstance } from './dns.js';

const port = parseInt(process.env.POLARIS_DNS_PORT || '5354', 10);
const upstream = process.env.POLARIS_DNS_UPSTREAM || 'https://cloudflare-dns.com/dns-query';

startDnsServerInstance(port, upstream);
