#!/usr/bin/env node

import ForestMCPServer from './server';

// Start the server when run directly as CLI
const server = new ForestMCPServer();

server.run().catch(error => {
  console.error('[FATAL] Server crashed:', error);
  process.exit(1);
});
