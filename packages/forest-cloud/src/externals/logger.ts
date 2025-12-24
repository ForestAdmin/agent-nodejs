import type { Logger } from '../types';

import ora from 'ora';

export const loggerPrefix = {
  Debug: '\x1b[34mdebug:\x1b[0m',
  Info: '\x1b[32minfo:\x1b[0m',
  Warn: '\x1b[33mwarning:\x1b[0m',
  Error: '\x1b[31merror:\x1b[0m',
};

export default (): Logger => {
  const addPrefix = (text: string, prefix: string) => {
    if (!prefix) return text;

    return `${prefix} | ${text}`;
  };

  const write = (text: string, outputType?: 'stderr' | 'stdout') => {
    if (outputType === 'stderr') process.stderr.write(text);
    else process.stdout.write(text);
  };

  const log = (text?: string, prefix?: string) => {
    write(`${addPrefix(text, prefix)}\n`);
  };

  const logLevel = (level: string, text?: string, prefix?: string) => {
    log(`${loggerPrefix[level]} ${text}`, prefix);
  };

  return {
    spinner: ora(),
    write: (text: string, outputType?: 'stderr' | 'stdout') => write(text, outputType),
    log: (text?: string, prefix?: string) => log(text, prefix),
    info: (text?: string, prefix?: string) => logLevel('Info', text, prefix),
    error: (text?: string, prefix?: string) => logLevel('Error', text, prefix),
    warn: (text?: string, prefix?: string) => logLevel('Warn', text, prefix),
    debug: (text?: string, prefix?: string) => logLevel('Debug', text, prefix),
  };
};
