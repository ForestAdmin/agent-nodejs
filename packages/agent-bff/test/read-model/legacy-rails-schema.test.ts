import type { ForestSchemaCollection } from '@forestadmin/forestadmin-client';

import fs from 'fs';
import path from 'path';

import unpackPrimaryKey from '../../src/data/pack-id';
import ReadModel from '../../src/read-model/read-model';
import synthesizeCapabilities from '../../src/read-model/synthesize-capabilities';

/**
 * A schema a real `forest_liana 9.15.8` backoffice published: 269 collections, 6274 fields, and not
 * one `isPrimaryKey` — that flag only appears in 9.17.6. Every collection there would answer
 * `500 mapping_error` on a plain list without the primary-key fallback, so this pins the fallback
 * against shapes a production Rails app actually contains rather than against invented ones.
 *
 * Whose schema it was does not matter and is not the point: that customer has since upgraded past
 * 9.17.6. What the fixture stands for is the tail that has not — of the 125 `forest-rails`
 * production and development environments active in the last 120 days, the twenty oldest by version
 * run between 2.14.6 and 8.3.2, all of them below the line.
 *
 * The committed fixture is a sample: one or two collections per shape, field lists trimmed. Point
 * `LEGACY_RAILS_SCHEMA` at a full schema file to run the same assertions over all of it.
 */
function loadSchema(): { collections: (ForestSchemaCollection & { why?: string })[] } {
  const override = process.env.LEGACY_RAILS_SCHEMA;
  const file = override ?? path.join(__dirname, 'fixtures/legacy-rails-schema.json');

  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

describe('the schema a pre-9.17.6 forest_liana publishes', () => {
  const { collections } = loadSchema();
  const readModel = new ReadModel(collections);
  const noopLogger = () => undefined;

  it('should carry no isPrimaryKey at all, which is what makes the fallback load-bearing', () => {
    const declared = collections.filter(collection =>
      (collection.fields ?? []).some(field => field.isPrimaryKey),
    );

    expect(declared).toEqual([]);
  });

  it('should still give every collection exactly one primary key', () => {
    const without = readModel
      .getAllowedCollections()
      .filter(name => readModel.getPrimaryKeys(name).length !== 1);

    expect(without).toEqual([]);
  });

  it('should let a record id round-trip for every collection, which is the 500 this prevents', () => {
    const failures = readModel.getAllowedCollections().filter(name => {
      try {
        unpackPrimaryKey('42', readModel.getPrimaryKeys(name));

        return false;
      } catch {
        return true;
      }
    });

    expect(failures).toEqual([]);
  });

  it('should take the declared type of the id field where the schema has one', () => {
    const named = collections.find(collection =>
      (collection.fields ?? []).some(field => field.field === 'id'),
    );
    const declared = (named?.fields ?? []).find(field => field.field === 'id');

    expect(readModel.getPrimaryKeys(named!.name)).toEqual([
      { name: 'id', type: declared?.type, derived: true },
    ]);
  });

  it('should invent a string key for a collection that declares no id field', () => {
    const anonymous = collections.find(
      collection => !(collection.fields ?? []).some(field => field.field === 'id'),
    );

    expect(anonymous).toBeDefined();
    expect(readModel.getPrimaryKeys(anonymous!.name)).toEqual([
      { name: 'id', type: 'String', derived: true },
    ]);
  });

  it('should synthesize capabilities for every collection without throwing', () => {
    const results = collections.map(collection => synthesizeCapabilities(collection, noopLogger));

    expect(results).toHaveLength(collections.length);
    expect(results.every(result => Array.isArray(result.fields))).toBe(true);
  });

  it('should publish a to-one relation without operators and omit a to-many one, as on v2', () => {
    const withRelations = collections.find(collection =>
      (collection.fields ?? []).some(field => field.relationship === 'BelongsTo'),
    );
    const capabilities = synthesizeCapabilities(withRelations!, noopLogger);
    const toOne = (withRelations?.fields ?? []).find(
      field => field.relationship === 'BelongsTo',
    )?.field;
    const toMany = (withRelations?.fields ?? [])
      .filter(field => field.relationship === 'HasMany')
      .map(field => field.field);
    const published = capabilities.fields.map(field => field.name);

    expect(capabilities.fields.find(field => field.name === toOne)).toEqual({
      name: toOne,
      type: 'ManyToOne',
    });
    expect(toMany.filter(name => published.includes(name))).toEqual([]);
  });

  // The fixture is what the SaaS serves, not the raw apimap the gem pushes: the keys arrive
  // camelCased. Getting that wrong once made every assertion below vacuous, so both tests start by
  // proving the schema actually carries denials to find.
  it('should publish no operator for a field the liana denies filtering', () => {
    const denied = collections.flatMap(collection =>
      (collection.fields ?? [])
        .filter(field => field.isFilterable === false)
        .map(field => ({ collection, name: field.field })),
    );

    expect(denied.length).toBeGreaterThan(0);

    const leaked = denied.filter(({ collection, name }) => {
      const published = synthesizeCapabilities(collection, noopLogger).fields.find(
        entry => entry.name === name,
      );

      return (published?.operators ?? []).length > 0;
    });

    expect(leaked).toEqual([]);
  });

  it('should publish a field the liana denies sorting as not sortable', () => {
    const denied = collections.flatMap(collection =>
      (collection.fields ?? [])
        .filter(field => field.isSortable === false)
        .map(field => ({ collection, name: field.field })),
    );

    expect(denied.length).toBeGreaterThan(0);

    const sortable = denied.filter(({ collection, name }) => {
      const published = synthesizeCapabilities(collection, noopLogger).fields.find(
        entry => entry.name === name,
      );

      return published !== undefined && published.sortable !== false;
    });

    expect(sortable).toEqual([]);
  });

  // Every sort denial in the fixture sits on a scalar column, so a relation that denies sorting has
  // to be built here. Published without `sortable: false`, the BFF would accept the sort and forward
  // it to a liana that rejects it.
  it('should carry a sort denial onto a to-one relation', () => {
    const collection = {
      name: 'WithDeniedRelationSort',
      fields: [
        { field: 'id', type: 'Number', isFilterable: true, isSortable: true },
        {
          field: 'author',
          type: 'Number',
          relationship: 'BelongsTo',
          reference: 'users.id',
          isFilterable: true,
          isSortable: false,
        },
      ],
    } as unknown as ForestSchemaCollection;

    const published = synthesizeCapabilities(collection, noopLogger).fields.find(
      entry => entry.name === 'author',
    );

    expect(published).toEqual({ name: 'author', type: 'ManyToOne', sortable: false });
  });
});
