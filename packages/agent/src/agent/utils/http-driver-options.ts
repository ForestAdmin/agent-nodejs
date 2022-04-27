import { existsSync } from 'fs';
import { parse as parsePath } from 'path';

import { AgentOptions } from '../../types';
import { AgentOptionsWithDefaults } from '../types';

export default class OptionsUtils {
  private static loggerPrefix = {
    Debug: '\x1b[34mdebug:\x1b[0m',
    Info: '\x1b[32minfo:\x1b[0m',
    Warn: '\x1b[33mwarning:\x1b[0m',
    Error: '\x1b[31merror:\x1b[0m',
  };

  static withDefaults(options: AgentOptions): AgentOptionsWithDefaults {
    const copyOptions = { ...options };

    const defaultLogger = (level, data) => {
      const loggerLevel = options.loggerLevel ?? 'Info';
      const levels = Object.keys(this.loggerPrefix);

      if (levels.indexOf(level) >= levels.indexOf(loggerLevel)) {
        console.error(OptionsUtils.loggerPrefix[level], data);
      }
    };

    copyOptions.logger = copyOptions.logger || defaultLogger;
    copyOptions.schemaPath = copyOptions.schemaPath || '.forestadmin-schema.json';
    copyOptions.forestServerUrl = copyOptions.forestServerUrl || 'https://api.forestadmin.com';

    return <AgentOptionsWithDefaults>Object.freeze({
      clientId: null,
      loggerLevel: 'Info',
      prefix: '/forest',
      permissionsCacheDurationInSeconds: 15 * 60,
      ...copyOptions,
    });
  }

  static validate(options: AgentOptionsWithDefaults): void {
    OptionsUtils.checkForestServerOptions(options);
    OptionsUtils.checkAuthOptions(options);
    OptionsUtils.checkOtherOptions(options);
  }

  private static checkForestServerOptions(options: AgentOptionsWithDefaults): void {
    if (typeof options.envSecret !== 'string' || !/^[0-9a-f]{64}$/.test(options.envSecret)) {
      throw new Error(
        'options.envSecret is invalid. You can retrieve its value from ' +
          'https://www.forestadmin.com',
      );
    }

    if (!OptionsUtils.isUrl(options.forestServerUrl)) {
      throw new Error(
        'options.forestServerUrl is invalid. It should contain an URL ' +
          '(i.e. "https://api.forestadmin.com")',
      );
    }

    if (!OptionsUtils.isExistingPath(options.schemaPath)) {
      throw new Error(
        'options.schemaPath is invalid. It should contain a relative filepath ' +
          'where the schema should be loaded/updated (i.e. "./.forestadmin-schema.json")',
      );
    }
  }

  private static checkAuthOptions(options: AgentOptionsWithDefaults): void {
    if (!OptionsUtils.isUrl(options.agentUrl)) {
      throw new Error(
        'options.agentUrl is invalid. It should contain an url where your agent is reachable ' +
          '(i.e. "https://api-forestadmin.mycompany.com")',
      );
    }

    if (typeof options.authSecret !== 'string') {
      throw new Error(
        'options.authSecret is invalid. Any long random string should work ' +
          '(i.e. "OfpssLrbgF3P4vHJTTpb"',
      );
    }

    if (options.clientId === null) {
      options.logger?.(
        'Warn',
        'options.clientId was not provided. Using Node.js cluster mode, ' +
          'or multiple instances of the agent will break authentication',
      );
    } else if (typeof options.clientId !== 'string') {
      throw new Error('options.clientId is invalid.');
    }
  }

  private static checkOtherOptions(options: AgentOptionsWithDefaults): void {
    if (typeof options.prefix !== 'string' || !/[-/a-z+]/.test(options.prefix)) {
      throw new Error(
        'options.prefix is invalid. It should contain the prefix on which ' +
          'forest admin routes should be mounted (i.e. "/forest")',
      );
    }
  }

  private static isExistingPath(string: unknown): boolean {
    if (typeof string !== 'string') {
      return false;
    }

    const parsed = parsePath(string);

    return parsed.dir.length ? existsSync(parsed.dir) : true;
  }

  private static isUrl(string: unknown): boolean {
    if (typeof string !== 'string') {
      return false;
    }

    try {
      const url = new URL(string);

      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }
}
