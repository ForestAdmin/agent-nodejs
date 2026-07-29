#!/usr/bin/env node

import ForestMCPServer from './server';
import parseToolList from './utils/parse-tool-list';

const toSeconds = (value?: string) => (value === undefined ? undefined : Number(value));

// Start the server when run directly as CLI
const server = new ForestMCPServer({
  forestServerUrl: process.env.FOREST_SERVER_URL || 'https://api.forestadmin.com',
  forestAppUrl: process.env.FOREST_APP_URL || 'https://app.forestadmin.com',
  envSecret: process.env.FOREST_ENV_SECRET,
  authSecret: process.env.FOREST_AUTH_SECRET,
  enabledTools: parseToolList(process.env.FOREST_MCP_ENABLED_TOOLS),
  agentUrl: process.env.FOREST_AGENT_URL,
  // normalizeTokenTtl rejects NaN and non-positive values, so a bad variable fails at startup.
  tokenTtl: {
    accessTokenSeconds: toSeconds(process.env.FOREST_MCP_ACCESS_TOKEN_TTL_SECONDS),
    refreshTokenSeconds: toSeconds(process.env.FOREST_MCP_REFRESH_TOKEN_TTL_SECONDS),
  },
});

server.run().catch(error => {
  console.error('[FATAL] Server crashed:', error);
  process.exit(1);
});
