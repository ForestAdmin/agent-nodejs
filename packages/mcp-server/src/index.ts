#!/usr/bin/env node

import ForestAdminMCPServer from './server';

// Start the server
const server = new ForestAdminMCPServer();

server.run().catch(error => {
  console.error('[FATAL] Server crashed:', error);
  process.exit(1);
});
