import { printError } from './display.js';

export const handleError = (msg, err, isJson = false) => {
  const isDebug = process.argv.includes('--debug');
  
  if (isJson) {
    const errorOutput = { error: msg, details: err ? err.message : undefined };
    if (isDebug && err && err.stack) {
      errorOutput.stack = err.stack;
    }
    console.log(JSON.stringify(errorOutput));
  } else {
    printError(msg, err);
    if (isDebug && err && err.stack) {
      console.error('\n' + err.stack);
    }
  }
  process.exitCode = 1;
};
