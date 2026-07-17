import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';
import boxen from 'boxen';
import gradient from 'gradient-string';
import { select } from '@inquirer/prompts';

export const printBanner = () => {
  const logo = `\n  polaris — Leave no trace.  `;
  console.log(gradient.pastel.multiline(logo));
  console.log(chalk.dim('  Your True North in Digital Privacy.\n'));
};

export const createSpinner = (text) => {
  return ora({ text, color: 'cyan' });
};

export const printError = (msg, err = null) => {
  console.error(chalk.red.bold(`\n✗ Error: ${msg}`));
  if (err && err.message) {
    console.error(chalk.dim(err.message));
  } else if (err) {
    console.error(chalk.dim(String(err)));
  }
};

export const printSuccess = (msg) => {
  console.log(chalk.green(`✓ ${msg}`));
};

export const printInfo = (msg) => {
  console.log(chalk.cyan(`ℹ ${msg}`));
};

export const printWarning = (msg) => {
  console.log(chalk.yellow(`⚠ ${msg}`));
};

export const createTable = (head = []) => {
  return new Table({
    head: head.map(h => chalk.cyan(h)),
    style: { head: [], border: [] }
  });
};

export const printBox = (title, content, type = 'info') => {
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
