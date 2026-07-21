import fs from 'fs';
import chalk from 'chalk';
import qrcode from 'qrcode-terminal';
import { printSuccess, printError, printBox } from '../utils/display.js';
import { importWgConfig, exportWgConfig } from '../core/config-export-service.js';

export const configImport = async (filePath, options) => {
  const isJson = options.json;
  const alias = options.alias;

  try {
    const res = importWgConfig(filePath, alias);

    if (isJson) {
      console.log(JSON.stringify({ success: true, ...res }));
    } else {
      printBox('Profile Imported Successfully 🚀', `Alias: ${res.alias}\nEndpoint: ${res.endpoint}\nLocal Config: ${res.configPath}`, 'success');
      console.log(chalk.cyan(`You can now connect to this profile using: "polaris start --server ${res.alias}"\n`));
    }
  } catch (err) {
    if (isJson) {
      console.log(JSON.stringify({ error: err.message }));
    } else {
      printError('Failed to import configuration', err);
    }
    process.exitCode = 1;
  }
};

export const configExport = async (alias, options) => {
  const isJson = options.json;
  const outFile = options.out;

  try {
    const confContent = exportWgConfig(alias);

    if (outFile) {
      fs.writeFileSync(outFile, confContent, 'utf-8');
      if (isJson) {
        console.log(JSON.stringify({ success: true, alias, outFile }));
      } else {
        printSuccess(`Exported configuration profile '${alias}' to ${outFile}`);
      }
      return;
    }

    if (isJson) {
      console.log(JSON.stringify({ success: true, alias, config: confContent }));
    } else {
      console.log(chalk.cyan(`\nConfiguration Profile '${alias}':\n`));
      console.log(confContent);
      console.log(chalk.cyan('\nScan this QR code with the WireGuard app on your mobile device:\n'));
      qrcode.generate(confContent, { small: true });
    }
  } catch (err) {
    if (isJson) {
      console.log(JSON.stringify({ error: err.message }));
    } else {
      printError('Failed to export configuration', err);
    }
    process.exitCode = 1;
  }
};
