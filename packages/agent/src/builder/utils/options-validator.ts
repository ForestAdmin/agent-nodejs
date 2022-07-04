/* eslint-disable @typescript-eslint/no-explicit-any */

export default class OptionsValidator {
  private static loggerPrefix = {
    Debug: '\x1b[34mdebug:\x1b[0m',
    Info: '\x1b[32minfo:\x1b[0m',
    Warn: '\x1b[33mwarning:\x1b[0m',
    Error: '\x1b[31merror:\x1b[0m',
  };

  static withDefaults(options: any): any {
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

    // const parsed = new URL(options.agentUrl);
    // copyOptions.prefix ??= joinPath('/', parsed.pathname, 'forest');
    copyOptions.prefix = '/forest';

    return {
      clientId: null,
      loggerLevel: 'Info',
      prefix: '/forest',
      permissionsCacheDurationInSeconds: 15 * 60,
      ...copyOptions,
    };
  }
}
