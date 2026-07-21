import test from 'node:test';
import assert from 'node:assert';
import { parseWgConfig } from '../src/core/config-export-service.js';

test('parseWgConfig correctly extracts interface and peer settings', () => {
  const sample = `
[Interface]
PrivateKey = sample_private_key_123456789012345678901=
Address = 10.0.0.2/24
DNS = 1.1.1.1

[Peer]
PublicKey = sample_public_key_1234567890123456789012=
Endpoint = 198.51.100.1:51820
AllowedIPs = 0.0.0.0/0
`;

  const parsed = parseWgConfig(sample);
  assert.strictEqual(parsed.interface.PrivateKey, 'sample_private_key_123456789012345678901=');
  assert.strictEqual(parsed.interface.Address, '10.0.0.2/24');
  assert.strictEqual(parsed.peer.PublicKey, 'sample_public_key_1234567890123456789012=');
  assert.strictEqual(parsed.peer.Endpoint, '198.51.100.1:51820');
});
