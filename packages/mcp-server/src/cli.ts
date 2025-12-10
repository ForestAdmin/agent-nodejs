#!/usr/bin/env node

import ForestAdminMCPServer from './server.js';

// Start the server when run directly as CLI
const server = new ForestAdminMCPServer();

server.run().catch(error => {
  console.error('[FATAL] Server crashed:', error);
  process.exit(1);
});
