import ora from 'ora';

import { Logger } from './types';

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

  const log = (level: string, text?: string, prefix?: string) => {
    process.stdout.write(addPrefix(`${loggerPrefix[level]} ${text}\n`, prefix));
  };

  return {
    spinner: ora(),
    log: (text?: string) => process.stdout.write(`${text}\n`),
    info: (text?: string, prefix?: string) => log('Info', text, prefix),
    error: (text?: string, prefix?: string) => log('Error', text, prefix),
    warn: (text?: string, prefix?: string) => log('Warn', text, prefix),
    debug: (text?: string, prefix?: string) => log('Debug', text, prefix),
  };
};
