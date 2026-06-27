import chalk from 'chalk';
import ora from 'ora';
import Table from 'cli-table3';

export const printBanner = () => {
  console.log(chalk.cyan.bold('\npolaris — Leave no trace.'));
  console.log(chalk.dim('Your True North in Digital Privacy.\n'));
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
