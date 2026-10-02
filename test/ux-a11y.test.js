import test from 'node:test';
import assert from 'node:assert';
import { generateBashCompletion, generateZshCompletion, generateFishCompletion } from '../src/commands/completion.js';
import { runEnvironmentDiagnostic } from '../src/commands/setup.js';
import { getRemediation } from '../src/utils/error-handler.js';
import { isNoColor, printSuccess, printError, printWarning, printInfo } from '../src/utils/display.js';
import { sendNotification } from '../src/utils/notifier.js';

test('completion scripts generate non-empty shell scripts', () => {
  const bash = generateBashCompletion();
  assert.ok(bash.includes('_polaris_completions'));
  assert.ok(bash.includes('complete -F'));

  const zsh = generateZshCompletion();
  assert.ok(zsh.includes('#compdef polaris'));
  assert.ok(zsh.includes('_polaris'));

  const fish = generateFishCompletion();
  assert.ok(fish.includes('complete -c polaris'));
});

test('runEnvironmentDiagnostic returns structured diagnostic array', () => {
  const results = runEnvironmentDiagnostic();
  assert.ok(Array.isArray(results));
  assert.ok(results.length >= 3);
  
  const nodeCheck = results.find(r => r.item.includes('Node.js'));
  assert.ok(nodeCheck);
  assert.strictEqual(nodeCheck.status, 'PASS');
});

test('getRemediation returns actionable suggestions for known errors', () => {
  const wgErr = getRemediation('failed to run tunnel', new Error('wg-quick: command not found'));
  assert.ok(Array.isArray(wgErr));
  assert.ok(wgErr.some(l => l.includes('wireguard-tools')));

  const portErr = getRemediation('tunnel failed', new Error('EADDRINUSE 1080'));
  assert.ok(Array.isArray(portErr));
  assert.ok(portErr.some(l => l.includes('polaris stop') || l.includes('-p')));

  const sshErr = getRemediation('deploy failed', new Error('Permission denied (publickey)'));
  assert.ok(Array.isArray(sshErr));
  assert.ok(sshErr.some(l => l.includes('ssh -i')));

  const unknownErr = getRemediation('custom error', new Error('random error'));
  assert.strictEqual(unknownErr, null);
});

test('isNoColor responds to NO_COLOR environment variable', () => {
  const oldNoColor = process.env.NO_COLOR;
  
  process.env.NO_COLOR = '1';
  assert.strictEqual(isNoColor(), true);

  delete process.env.NO_COLOR;
  assert.strictEqual(isNoColor(), false);

  if (oldNoColor !== undefined) {
    process.env.NO_COLOR = oldNoColor;
  }
});

test('display functions execute without throwing in color and no-color modes', () => {
  assert.doesNotThrow(() => {
    printSuccess('test success');
    printError('test error');
    printWarning('test warning');
    printInfo('test info');
  });
});

test('sendNotification safely runs without throwing', () => {
  assert.doesNotThrow(() => {
    sendNotification({ title: 'Test', message: 'Test message' });
  });
});
