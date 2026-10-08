#!/usr/bin/env node

import parseMcpEnv from './mcp-env';
import ForestMCPServer from './server';
import loadFileUploads from './utils/load-file-uploads';

const DEPRECATION_WARNING =
  'forest-mcp-server is deprecated: it keeps working, but new deployments should run ' +
  'forest-gateway (@forestadmin/gateway): ' +
  'https://docs.forestadmin.com/product/embed/gateway-standalone';

async function main() {
  console.warn(DEPRECATION_WARNING);

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
