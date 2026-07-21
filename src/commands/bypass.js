import chalk from 'chalk';
import { printSuccess, printError, printInfo, createTable } from '../utils/display.js';
import { getBypassRules, addBypassRule, removeBypassRule } from '../utils/bypass.js';

export const bypassAdd = async (target, options) => {
  const isJson = options.json;
  try {
    const rules = addBypassRule(target);
    if (isJson) {
      console.log(JSON.stringify({ success: true, target, rules }));
    } else {
      printSuccess(`Added bypass rule for '${target}'. Traffic to this destination will route outside the VPN.`);
    }
  } catch (err) {
    if (isJson) {
      console.log(JSON.stringify({ error: err.message }));
    } else {
      printError('Failed to add bypass rule', err);
    }
    process.exitCode = 1;
  }
};

export const bypassRemove = async (target, options) => {
  const isJson = options.json;
  try {
    const rules = removeBypassRule(target);
    if (isJson) {
      console.log(JSON.stringify({ success: true, target, rules }));
    } else {
      printSuccess(`Removed bypass rule for '${target}'.`);
    }
  } catch (err) {
    if (isJson) {
      console.log(JSON.stringify({ error: err.message }));
    } else {
      printError('Failed to remove bypass rule', err);
    }
    process.exitCode = 1;
  }
};

export const bypassList = async (options) => {
  const isJson = options.json;
  const rules = getBypassRules();

  if (isJson) {
    console.log(JSON.stringify({ rules }));
    return;
  }

  if (rules.length === 0) {
    printInfo('No bypass rules configured. Use "polaris bypass add <domain|ip>".');
    return;
  }

  const table = createTable(['Rule #', 'Destination (Bypass Target)']);
  rules.forEach((rule, idx) => {
    table.push([(idx + 1).toString(), chalk.cyan(rule)]);
  });

  console.log('\n' + table.toString() + '\n');
};
