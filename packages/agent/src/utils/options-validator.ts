import { existsSync } from 'fs';
import createForestAdminClient from '@forestadmin/forestadmin-client';
import path from 'path';

import { AgentOptions, AgentOptionsWithDefaults } from '../types';

export default class OptionsValidator {
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
        console.error(OptionsValidator.loggerPrefix[level], data);
      }
    };

    copyOptions.logger = copyOptions.logger || defaultLogger;
    copyOptions.schemaPath = copyOptions.schemaPath || '.forestadmin-schema.json';
    copyOptions.forestServerUrl = copyOptions.forestServerUrl || 'https://api.forestadmin.com';
    copyOptions.typingsMaxDepth = copyOptions.typingsMaxDepth ?? 5;
    copyOptions.prefix = copyOptions.prefix || '';
    copyOptions.permissionsCacheDurationInSeconds =
      copyOptions.permissionsCacheDurationInSeconds ?? 15 * 60;
    copyOptions.loggerLevel = copyOptions.loggerLevel || 'Info';

    copyOptions.forestAdminClient =
      copyOptions.forestAdminClient ||
      createForestAdminClient({
        envSecret: copyOptions.envSecret,
        forestServerUrl: copyOptions.forestServerUrl,
        logger: copyOptions.logger,
        permissionsCacheDurationInSeconds: copyOptions.permissionsCacheDurationInSeconds,
      });

    return copyOptions as AgentOptionsWithDefaults;
  }

  static validate(options: AgentOptions): AgentOptionsWithDefaults {
    OptionsValidator.checkForestServerOptions(options);
    OptionsValidator.checkAuthOptions(options);
    OptionsValidator.checkOtherOptions(options);

    return options as AgentOptionsWithDefaults;
  }

  private static checkForestServerOptions(options: AgentOptions): void {
    if (typeof options.envSecret !== 'string' || !/^[0-9a-f]{64}$/.test(options.envSecret)) {
      throw new Error(
        'options.envSecret is invalid. You can retrieve its value from ' +
          'https://www.forestadmin.com',
      );
    }

    if (!OptionsValidator.isUrl(options.forestServerUrl)) {
      throw new Error(
        'options.forestServerUrl is invalid. It should contain an URL ' +
          '(i.e. "https://api.forestadmin.com")',
      );
    }

    if (!OptionsValidator.isExistingPath(options.schemaPath)) {
      throw new Error(
        'options.schemaPath is invalid. It should contain a relative filepath ' +
          'where the schema should be loaded/updated (i.e. "./.forestadmin-schema.json")',
      );
    }

    if (options.typingsPath && !OptionsValidator.isExistingPath(options.typingsPath)) {
      throw new Error(
        'options.typingsPath is invalid. It should contain a relative filepath ' +
          'where the schema should be loaded/updated (i.e. "./src/typings.ts")',
      );
    }
  }

  private static checkAuthOptions(options: AgentOptions): void {
    if (typeof options.authSecret !== 'string') {
      throw new Error(
        'options.authSecret is invalid. Any long random string should work ' +
          '(i.e. "OfpssLrbgF3P4vHJTTpb"',
      );
    }
  }

  private static checkOtherOptions(options: AgentOptions): void {
    if (typeof options.prefix !== 'string' || !/^[-~/\w]*$/i.test(options.prefix)) {
      throw new Error(
        'options.prefix is invalid. It should contain the prefix on which ' +
          'forest admin routes should be mounted (i.e. "/api/v1")',
      );
    }
  }

  private static isExistingPath(string: unknown): boolean {
    if (typeof string !== 'string') {
      return false;
    }

    const parsed = path.parse(string);

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
