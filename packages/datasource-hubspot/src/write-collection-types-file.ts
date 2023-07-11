/* This script is useful for generate autocompletion for the HubSpot API. */

import { Logger } from '@forestadmin/datasource-toolkit';
import { Client } from '@hubspot/api-client';
import * as fs from 'fs';

import getCollectionFields from './get-collection-fields';

export default async function writeCollectionTypesFile(
  client: Client,
  collectionsNames: string[],
  path: string,
  logger?: Logger,
): Promise<void> {
  const fieldsByCollection = await getCollectionFields(client, collectionsNames, logger);

  if (Object.values(fieldsByCollection).flat().length === 0) {
    return logger?.('Warn', 'No collection found. Nothing to write.');
  }

  const stream = fs.createWriteStream(path);
  stream.write('/** This file is auto-generated. Do not edit manually. */\n');
  stream.write('export type TypingsHubspot = {\n');

  // iterate over collections to keep the same order
  collectionsNames.forEach(collection => {
    if (!fieldsByCollection[collection]) return;

    stream.write(`  ${collection}?: Array<\n`);

    fieldsByCollection[collection].forEach(field => {
      stream.write(`    | '${field}'\n`);
    });

    stream.write('  >;\n');
  });

  stream.write('};\n');
  stream.end();
}
