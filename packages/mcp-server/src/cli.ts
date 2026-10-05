#!/usr/bin/env node

import parseMcpEnv from './mcp-env';
import ForestMCPServer from './server';
import loadFileUploads from './utils/load-file-uploads';

async function main() {
  const { options, uploadStorageModule } = parseMcpEnv(process.env);
  const fileUploads = await loadFileUploads(uploadStorageModule);

  const server = new ForestMCPServer({
    ...options,
    ...(fileUploads !== undefined && { fileUploads }),
  });

  await server.run();
}

main().catch(error => {
  console.error('[FATAL] Server crashed:', error);
  process.exit(1);
});
