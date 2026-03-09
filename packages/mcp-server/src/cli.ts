#!/usr/bin/env node

import dotenv from 'dotenv';

import { generateToken } from './generate-token';
import ForestMCPServer from './server';

export const KNOWN_FLAGS = new Set([
  'env-secret',
  'auth-secret',
  'token',
  'expires-in',
  'forest-server-url',
  'rendering-id',
  'env-file',
]);

export function parseArgs(args: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg.startsWith('--')) {
      const key = arg.slice(2);

      if (!KNOWN_FLAGS.has(key)) {
        throw new Error(
          `Unknown option: ${arg}. Valid options: ${[...KNOWN_FLAGS]
            .map(f => `--${f}`)
            .join(', ')}`,
        );
      }

      if (i + 1 >= args.length || args[i + 1].startsWith('--')) {
        throw new Error(`Option ${arg} requires a value.`);
      }

      parsed[key] = args[i + 1];
      i += 2;
    } else {
      throw new Error(`Unexpected argument: "${arg}". All options must use --flag value format.`);
    }
  }

  return parsed;
}

export async function handleGenerateToken(args: string[]): Promise<void> {
  const parsed = parseArgs(args);

  if (parsed['env-file']) {
    const result = dotenv.config({ path: parsed['env-file'], override: true });

    if (result.error) {
      throw new Error(`Failed to load env file "${parsed['env-file']}": ${result.error.message}`);
    }
  }

  const { token, warnings } = await generateToken({
    envSecret: parsed['env-secret'] || process.env.FOREST_ENV_SECRET,
    authSecret: parsed['auth-secret'] || process.env.FOREST_AUTH_SECRET,
    token: parsed.token || process.env.FOREST_PERSONAL_TOKEN,
    renderingId: parsed['rendering-id'] || process.env.FOREST_RENDERING_ID,
    expiresIn: parsed['expires-in'],
    forestServerUrl: parsed['forest-server-url'] || process.env.FOREST_SERVER_URL,
  });

  for (const warning of warnings) {
    process.stderr.write(`${warning}\n`);
  }

  process.stdout.write(`${token}\n`);
}

const cliArgs = process.argv.slice(2);

if (cliArgs[0] === 'generate-token') {
  handleGenerateToken(cliArgs.slice(1)).catch(error => {
    process.stderr.write(`Error: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
} else if (cliArgs.length > 0 && cliArgs[0] && !cliArgs[0].startsWith('--')) {
  process.stderr.write(
    `Unknown command: "${cliArgs[0]}". Available commands: generate-token\n` +
      `To start the MCP server, run without arguments.\n`,
  );
  process.exit(1);
} else {
  // Start the server when run directly as CLI
  const server = new ForestMCPServer({
    forestServerUrl: process.env.FOREST_SERVER_URL || 'https://api.forestadmin.com',
    forestAppUrl: process.env.FOREST_APP_URL || 'https://app.forestadmin.com',
    envSecret: process.env.FOREST_ENV_SECRET,
    authSecret: process.env.FOREST_AUTH_SECRET,
  });

  server.run().catch(error => {
    console.error('[FATAL] Server crashed:', error);
    process.exit(1);
  });
}
