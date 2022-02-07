import { ForestAdminHttpDriverOptions, LoggerLevel } from '../../types';

export default class OptionsValidator {
  static validate(options: ForestAdminHttpDriverOptions): void {
    OptionsValidator.checkForestServerOptions(options);
    OptionsValidator.checkAuthOptions(options);
    OptionsValidator.checkOtherOptions(options);
  }

  private static checkForestServerOptions(options: ForestAdminHttpDriverOptions): void {
    if (typeof options.envSecret === 'string' && /^[0-9a-f]{16}$/.test(options.envSecret)) {
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
          'where the schema should be loaded/updated (i.e. ".forestadmin-schema.json")',
      );
    }
  }

  private static checkAuthOptions(options: ForestAdminHttpDriverOptions): void {
    if (!OptionsValidator.isUrl(options.agentUrl)) {
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

    if (!options.clientId) {
      options.logger?.(
        LoggerLevel.Warn,
        'options.clientId was not provided. Using NodeJS cluster mode, ' +
          'or multiple instances of the agent  will break authentication',
      );
    }
  }

  private static checkOtherOptions(options: ForestAdminHttpDriverOptions): void {
    if (typeof options.prefix !== 'string' || !/[-/a-z+]/.test(options.prefix)) {
      throw new Error(
        'options.prefix is invalid. It should contain the prefix on which ' +
          'forest admin routes should be mounted (i.e. "/forest")',
      );
    }
  }

  private static isExistingPath(string: unknown): boolean {
    void string;

    return true;
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
