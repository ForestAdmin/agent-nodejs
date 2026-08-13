#!/usr/bin/env node

import ForestMCPServer from './server';
import loadFileUploads from './utils/load-file-uploads';
import parseDomainList from './utils/parse-domain-list';
import parseToolList from './utils/parse-tool-list';

const toSeconds = (value?: string) => (value === undefined ? undefined : Number(value));

async function main() {
  // Loaded before constructing, so a bad module fails at startup like every other option. Uploads
  // are on without it, held in memory; this only points them at a real backend.
  const fileUploads = await loadFileUploads(process.env.FOREST_MCP_UPLOAD_STORAGE_MODULE);

  const server = new ForestMCPServer({
    forestServerUrl: process.env.FOREST_SERVER_URL || 'https://api.forestadmin.com',
    forestAppUrl: process.env.FOREST_APP_URL || 'https://app.forestadmin.com',
    envSecret: process.env.FOREST_ENV_SECRET,
    authSecret: process.env.FOREST_AUTH_SECRET,
    enabledTools: parseToolList(process.env.FOREST_MCP_ENABLED_TOOLS),
    allowedOAuthClients: parseDomainList(process.env.FOREST_MCP_ALLOWED_OAUTH_CLIENTS),
    agentUrl: process.env.FOREST_AGENT_URL,
    // normalizeTokenTtl rejects NaN and non-positive values, so a bad variable fails at startup.
    tokenTtl: {
      accessTokenSeconds: toSeconds(process.env.FOREST_MCP_ACCESS_TOKEN_TTL_SECONDS),
      refreshTokenSeconds: toSeconds(process.env.FOREST_MCP_REFRESH_TOKEN_TTL_SECONDS),
    },
    ...(fileUploads && { fileUploads }),
  });

  await server.run();
}

main().catch(error => {
  console.error('[FATAL] Server crashed:', error);
  process.exit(1);
});
