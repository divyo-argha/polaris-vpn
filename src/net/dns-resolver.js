import dns2 from 'dns2';
import fetch from 'node-fetch';

export const resolveViaDoh = async (name, typeNum, upstreamUrl) => {
  const typeMap = {
    1: 'A',
    28: 'AAAA',
    15: 'MX',
    16: 'TXT',
    5: 'CNAME',
    2: 'NS',
    6: 'SOA',
    12: 'PTR'
  };
  const typeName = typeMap[typeNum] || 'A';
  
  const url = `${upstreamUrl}?name=${encodeURIComponent(name)}&type=${typeName}`;
  const response = await fetch(url, {
    headers: { 'accept': 'application/dns-json' }
  });
  
  if (!response.ok) {
    throw new Error(`Upstream returned ${response.status}`);
  }
  
  return await response.json();
};

export const startDnsServerInstance = (port = 5354, upstream = 'https://cloudflare-dns.com/dns-query') => {
  const { Packet } = dns2;

  const server = dns2.createServer({
    udp: true,
    handle: async (request, send) => {
      const response = Packet.createResponseFromRequest(request);
      
      for (const question of request.questions) {
        try {
          const dohRes = await resolveViaDoh(question.name, question.type, upstream);
          if (dohRes.Answer) {
            for (const ans of dohRes.Answer) {
              response.answers.push({
                name: ans.name,
                type: ans.type,
                class: Packet.CLASS.IN,
                ttl: ans.TTL || 300,
                address: ans.data
              });
            }
          }
        } catch (err) {
          // Ignore resolution failure on single record
        }
      }
      
      send(response);
    }
  });

  server.listen({ udp: port }).then(() => {
    console.log(`Polaris DNS-over-HTTPS local resolver listening on 127.0.0.1:${port}`);
    console.log(`Using upstream: ${upstream}`);
  }).catch((err) => {
    console.error('DNS server failed to start:', err);
  });

  server.on('error', (err) => {
    console.error('DNS server error:', err);
  });
  
  return server;
};
