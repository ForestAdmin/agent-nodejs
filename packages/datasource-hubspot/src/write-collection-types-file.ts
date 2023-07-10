/* This script is useful for generate autocompletion for the HubSpot API. */

import { Logger } from '@forestadmin/datasource-toolkit';
import { Client } from '@hubspot/api-client';
import * as fs from 'fs';

import getCollectionFields from './get-collection-fields';

export default async function writeCollectionTypesFile(
  client: Client,
  typingsPath: string,
  logger?: Logger,
): Promise<void> {
  const collections = [
    'companies',
    'contacts',
    'deals',
    'feedback_submissions',
    'goal_targets',
    'line_items',
    'products',
    'quotes',
    'tickets',
  ];
  const fieldsByCollection = await getCollectionFields(client, collections, logger);
  const stream = fs.createWriteStream(typingsPath);
  stream.write('/** This file is auto-generated. Do not edit manually. */\n');
  stream.write('export type TypingsHubspot = {\n');

  // iterate over collections to keep the same order
  collections.forEach(collection => {
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
