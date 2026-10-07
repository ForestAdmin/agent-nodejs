import { ConfigurationError } from '@forestadmin/agent-bff';

export interface Resolution {
  key: string;
  value?: string;
}

function isSet(value: string | undefined): value is string {
  return value !== undefined && value.trim() !== '';
}

export default class EnvAliases {
  readonly warnings: string[] = [];

  constructor(private readonly env: NodeJS.ProcessEnv) {}

  resolve(name: string, aliases: readonly string[] = []): Resolution {
    const usedAliases = aliases.filter(alias => isSet(this.env[alias]));

    if (isSet(this.env[name])) {
      usedAliases.forEach(alias => this.warnings.push(`${alias} is ignored: ${name} is set`));

      return { key: name, value: this.env[name] };
    }

    if (new Set(usedAliases.map(alias => this.env[alias]?.trim())).size > 1) {
      throw new ConfigurationError(
        `${usedAliases.join(' and ')} disagree: set ${name} to the value the Gateway should use.`,
      );
    }

    usedAliases.forEach(alias =>
      this.warnings.push(`${alias} is a legacy name: use ${name} instead`),
    );

    return usedAliases.length > 0
      ? { key: usedAliases[0], value: this.env[usedAliases[0]] }
      : { key: name };
  }

  ignore(keys: readonly string[], reason: string): void {
    keys
      .filter(key => isSet(this.env[key]))
      .forEach(key => this.warnings.push(`${key} is ignored: ${reason}`));
  }
}
