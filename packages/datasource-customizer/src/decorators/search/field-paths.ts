import type { Collection, ColumnSchema } from '@forestadmin/datasource-toolkit';

import normalizeName from './normalize-name';
import { extractSpecifiedFields, parseQuery } from './parse-query';

export function lenientGetSchema(
  collection: Collection,
  path: string,
): { field: string; schema: ColumnSchema } | null {
  const [prefix, suffix] = path.split(/:(.*)/);
  const fuzzyPrefix = normalizeName(prefix);

  for (const [field, schema] of Object.entries(collection.schema.fields)) {
    if (fuzzyPrefix === normalizeName(field)) {
      if (!suffix && schema.type === 'Column') {
        return { field, schema };
      }

      if (
        suffix &&
        (schema.type === 'OneToMany' || schema.type === 'ManyToOne' || schema.type === 'OneToOne')
      ) {
        const related = collection.dataSource.getCollection(schema.foreignCollection);
        const fuzzy = lenientGetSchema(related, suffix);

        if (fuzzy) return { field: `${field}:${fuzzy.field}`, schema: fuzzy.schema };
      }
    }
  }

  return null;
}

/**
 * The field paths a search string reaches through the `relation.column:term` syntax, resolved the
 * same way the search decorator resolves them — fuzzily, and across to-many relations too.
 */
export function getSearchedFieldPaths(collection: Collection, search: string): string[] {
  return extractSpecifiedFields(parseQuery(search))
    .map(name => lenientGetSchema(collection, name)?.field)
    .filter(Boolean);
}

export function getLeafCollectionName(collection: Collection, path: string): string {
  const index = path.indexOf(':');

  if (index === -1) return collection.name;

  const relation = collection.schema.fields[path.substring(0, index)];

  if (!relation || relation.type === 'Column') return collection.name;

  return getLeafCollectionName(
    collection.dataSource.getCollection(relation.foreignCollection),
    path.substring(index + 1),
  );
}
