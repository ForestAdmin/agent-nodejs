#!/usr/bin/env node

import ForestAdminMCPServer from './server';

// Export for library usage
// eslint-disable-next-line import/prefer-default-export
export { default as ForestAdminMCPServer } from './server';

// Start the server when run directly as CLI
const server = new ForestAdminMCPServer();

server.run().catch(error => {
  console.error('[FATAL] Server crashed:', error);
  process.exit(1);
});
