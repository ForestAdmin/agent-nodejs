import { existsSync } from 'fs';
import { parse as parsePath } from 'path';
import {
  ForestAdminHttpDriverOptions,
  ForestAdminHttpDriverOptionsWithDefaults,
  LoggerLevel,
} from '../types';

export default class OptionsUtils {
  static withDefaults(
    options: ForestAdminHttpDriverOptions,
  ): ForestAdminHttpDriverOptionsWithDefaults {
    return Object.freeze({
      clientId: null,
      forestServerUrl: 'https://api.forestadmin.com',
      logger: console.error, // eslint-disable-line no-console
      prefix: '/forest',
      schemaPath: '.forestadmin-schema.json',
      scopesCacheDurationInSeconds: 15 * 60,
      ...options,
    });
  }

  static validate(options: ForestAdminHttpDriverOptionsWithDefaults): void {
    OptionsUtils.checkForestServerOptions(options);
    OptionsUtils.checkAuthOptions(options);
    OptionsUtils.checkOtherOptions(options);
  }

  private static checkForestServerOptions(options: ForestAdminHttpDriverOptionsWithDefaults): void {
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

  private static checkAuthOptions(options: ForestAdminHttpDriverOptionsWithDefaults): void {
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
        LoggerLevel.Warn,
        'options.clientId was not provided. Using NodeJS cluster mode, ' +
          'or multiple instances of the agent  will break authentication',
      );
    } else if (typeof options.clientId !== 'string') {
      throw new Error('options.clientId is invalid.');
    }
  }

  private static checkOtherOptions(options: ForestAdminHttpDriverOptionsWithDefaults): void {
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
