/* This script is useful for generate autocompletion for the HubSpot API. */

import { Logger } from '@forestadmin/datasource-toolkit';
import * as fs from 'fs';

import { FieldPropertiesByCollection } from './types';

function buildType(fieldPropertiesByCollection: FieldPropertiesByCollection): string {
  let file = '/** This file is auto-generated. Do not edit manually. */\n';
  file += 'export type TypingsHubspot = {\n';

  // sort collection name to keep the same order when regenerating the file
  const collections = Object.keys(fieldPropertiesByCollection).sort((a, b) => a.localeCompare(b));
  collections.forEach(collection => {
    if (!fieldPropertiesByCollection[collection]) return;
    // sort field name to keep the same order when regenerating the file
    const names = fieldPropertiesByCollection[collection]
      .map(property => property.name)
      .sort((a, b) => a.localeCompare(b));

    file += `  ${collection}?: Array<\n`;
    names.forEach(name => {
      file += `    | '${name}'\n`;
    });
    file += '  >;\n';
  });

  file += '};\n';

  return file;
}

export default function generateTypesIfChange(
  fieldPropertiesByCollection: FieldPropertiesByCollection,
  path: string,
  logger?: Logger,
): void {
  const newTypings = buildType(fieldPropertiesByCollection);
  const oldTypings = fs.readFileSync(path, { encoding: 'utf-8', flag: 'a+' });

  // avoid to write the same content
  if (oldTypings !== newTypings) {
    logger?.('Info', 'Generating collection types');
    fs.writeFileSync(path, newTypings);
    logger('Info', 'Collection types generated');
  }
}
