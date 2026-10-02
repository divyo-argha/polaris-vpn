import test from 'node:test';
import assert from 'node:assert';
import { getWatchdogStatus, runWatchdogCheck } from '../src/core/watchdog-service.js';
import { enableSystemProxy, disableSystemProxy } from '../src/net/system-proxy.js';
import { runSpeedTest } from '../src/core/speedtest-service.js';

test('watchdog returns accurate status when idle', () => {
  const status = getWatchdogStatus();
  assert.ok(typeof status.running === 'boolean');
  assert.ok(typeof status.lastStatus === 'string');
});

test('watchdog check handles absence of active tunnel gracefully', async () => {
  const check = await runWatchdogCheck();
  assert.strictEqual(check.healthy, false);
  assert.match(check.reason, /no active tunnel/i);
});

test('system proxy enable and disable execute without throwing', () => {
  assert.doesNotThrow(() => {
    enableSystemProxy(1080);
    disableSystemProxy();
  });
});

test('speedtest runs and returns metrics object', async () => {
  const metrics = await runSpeedTest();
  assert.ok(typeof metrics.publicIp === 'string');
  assert.ok(typeof metrics.pingMs === 'number');
  assert.ok(typeof metrics.downloadSpeedMbps === 'number');
  assert.ok(typeof metrics.rating === 'string');
});
