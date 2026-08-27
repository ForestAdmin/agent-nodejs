import type {
  Collection,
  ColumnSchema,
  FieldSchema,
  RelationSchema,
} from '@forestadmin/datasource-toolkit';

import { SchemaUtils } from '@forestadmin/datasource-toolkit';

import normalizeName from './normalize-name';
import { extractSpecifiedFields, parseQuery } from './parse-query';

const SEARCHABLE_THROUGH = ['OneToMany', 'ManyToOne', 'OneToOne'];

const isSearchableThrough = (schema: FieldSchema): schema is RelationSchema =>
  SEARCHABLE_THROUGH.includes(schema.type);

export function lenientGetSchema(
  collection: Collection,
  path: string,
): { field: string; schema: ColumnSchema } | null {
  const [prefix, suffix] = path.split(/:(.*)/);
  const fuzzyPrefix = normalizeName(prefix);
  const matches = Object.entries(collection.schema.fields).filter(
    ([field]) => fuzzyPrefix === normalizeName(field),
  );

  if (!suffix) {
    const column = matches.find(([, schema]) => schema.type === 'Column');

    return column ? { field: column[0], schema: column[1] as ColumnSchema } : null;
  }

  for (const [field, schema] of matches) {
    if (isSearchableThrough(schema)) {
      const related = collection.dataSource.getCollection(schema.foreignCollection);
      const fuzzy = lenientGetSchema(related, suffix);

      if (fuzzy) return { field: `${field}:${fuzzy.field}`, schema: fuzzy.schema };
    }
  }

  return null;
}

/**
 * The field paths a search string reaches through the `relation.column:term` syntax, resolved
 * fuzzily and across to-many relations too.
 *
 * Unused by the decorator, which derives its own footprint from `getSearchableFields` so the paths
 * it reports and the ones it searches cannot diverge. Kept only because it has been exported from
 * the package index since 1.71.x; nothing keeps it in step with what a search actually reads.
 */
export function getSearchedFieldPaths(collection: Collection, search: string): string[] {
  return extractSpecifiedFields(parseQuery(search))
    .map(name => lenientGetSchema(collection, name)?.field)
    .filter(Boolean);
}

/**
 * The collection a path's last column belongs to — the one a read permission applies to. A prefix
 * that names no relation throws rather than falling back to `collection`, which the caller pins to
 * readable: an unresolvable path must not read as an allowed one.
 */
export function getLeafCollectionName(collection: Collection, path: string): string {
  const index = path.indexOf(':');

  if (index === -1) return collection.name;

  const relation = SchemaUtils.getRelation(
    collection.schema,
    path.substring(0, index),
    collection.name,
  );

  return getLeafCollectionName(
    collection.dataSource.getCollection(relation.foreignCollection),
    path.substring(index + 1),
  );
}
