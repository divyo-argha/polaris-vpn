import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import boxen from 'boxen';
import gradient from 'gradient-string';
import { select } from '@inquirer/prompts';

export const isNoColor = () => {
  return process.env.NO_COLOR !== undefined || process.env.NODE_DISABLE_COLORS !== undefined;
};

export const printBanner = () => {
  const logo = `\n  polaris — Leave no trace.  `;
  if (isNoColor()) {
    console.log(logo);
    console.log('  Your True North in Digital Privacy.\n');
  } else {
    console.log(gradient.pastel.multiline(logo));
    console.log(chalk.dim('  Your True North in Digital Privacy.\n'));
  }
};

export const createSpinner = (text) => {
  if (isNoColor()) {
    return {
      start: (msg) => { if (msg) console.log(`[WORKING] ${msg}`); return this; },
      succeed: (msg) => console.log(`[SUCCESS] ✓ ${msg || text}`),
      fail: (msg) => console.log(`[ERROR] ✗ ${msg || text}`),
      warn: (msg) => console.log(`[WARN] ⚠ ${msg || text}`),
      info: (msg) => console.log(`[INFO] ℹ ${msg || text}`),
      stop: () => {}
    };
  }
  return ora({ text, color: 'cyan' });
};

export const printError = (msg, err = null) => {
  if (isNoColor()) {
    console.error(`\n[ERROR] ✗ Error: ${msg}`);
  } else {
    console.error(chalk.red.bold(`\n✗ Error: ${msg}`));
  }
  if (err && err.message) {
    console.error(isNoColor() ? `  ${err.message}` : chalk.dim(err.message));
  } else if (err) {
    console.error(isNoColor() ? `  ${String(err)}` : chalk.dim(String(err)));
  }
};

export const printSuccess = (msg) => {
  console.log(isNoColor() ? `[SUCCESS] ✓ ${msg}` : chalk.green(`✓ ${msg}`));
};

export const printInfo = (msg) => {
  console.log(isNoColor() ? `[INFO] ℹ ${msg}` : chalk.cyan(`ℹ ${msg}`));
};

export const printWarning = (msg) => {
  console.log(isNoColor() ? `[WARNING] ⚠ ${msg}` : chalk.yellow(`⚠ ${msg}`));
};

export const createTable = (head = []) => {
  if (isNoColor()) {
    return new Table({
      head: head.map(h => `[${h}]`),
      style: { head: [], border: [] }
    });
  }
  return new Table({
    head: head.map(h => chalk.cyan(h)),
    style: { head: [], border: [] }
  });
};

export const printBox = (title, content, type = 'info') => {
  if (isNoColor()) {
    console.log(`\n--- ${title} ---`);
    console.log(content);
    console.log(`----------------\n`);
    return;
  }
  const colors = {
    info: 'cyan',
    success: 'green',
    warning: 'yellow',
    error: 'red'
  };
  console.log(boxen(content, {
    title: chalk[colors[type] || 'cyan'](title),
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: colors[type] || 'cyan'
  }));
};

export const promptSelection = async (message, choices) => {
  return select({
    message,
    choices
  });
};

