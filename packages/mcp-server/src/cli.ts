#!/usr/bin/env node

import ForestMCPServer from './server.js';

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
