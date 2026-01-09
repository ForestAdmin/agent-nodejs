import type { ForestAdminClientOptionsWithDefaults } from '../types';

export type HttpOptions = Pick<
  ForestAdminClientOptionsWithDefaults,
  'envSecret' | 'forestServerUrl'
>;

export function toHttpOptions(options: {
  envSecret: string;
  forestServerUrl: string;
}): HttpOptions {
  return {
    envSecret: options.envSecret,
    forestServerUrl: options.forestServerUrl,
  };
}
