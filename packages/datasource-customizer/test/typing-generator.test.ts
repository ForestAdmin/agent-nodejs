/* eslint-disable max-len,jest/expect-expect */
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import TypingGenerator from '../src/typing-generator';

const expectEqual = (a: string, b: string) => {
  const aWithoutSpaces = a.replace(/[ \n]+/g, '');
  const bWithoutSpaces = b.replace(/[ \n]+/g, '');

  expect(aWithoutSpaces).toEqual(bWithoutSpaces);
};

const expectContains = (a: string, b: string) => {
  const aWithoutSpaces = a.replace(/[ \n]+/g, '');
  const bWithoutSpaces = b.replace(/[ \n]+/g, '');

  expect(aWithoutSpaces.includes(bWithoutSpaces)).toBeTruthy();
};

describe('TypingGenerator', () => {
  test('should work with a single collection', () => {
    const datasource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'aCollectionName',
        schema: {
          fields: {
            id: factories.columnSchema.build({ columnType: 'Number' }),
            boolean: factories.columnSchema.build({ columnType: 'Boolean' }),
            string: factories.columnSchema.build({ columnType: 'String' }),
            point: factories.columnSchema.build({ columnType: 'Point' }),
            enumWithValues: factories.columnSchema.build({
              columnType: 'Enum',
              enumValues: ['a', 'b', 'c'],
            }),
            enumWithoutValues: factories.columnSchema.build({
              columnType: 'Enum',
              enumValues: undefined,
            }),

            complex: factories.columnSchema.build({
              columnType: { firstname: 'String', lastname: 'String' },
            }),
            array: factories.columnSchema.build({ columnType: ['String'] }),
          },
        },
      }),
    ]);

    const generated = TypingGenerator.generateTypes(datasource, 5);
    const expected = `
      /* eslint-disable */
      import { CollectionCustomizer, TAggregation, TConditionTree, TPaginatedFilter, TPartialRow, TSortClause } from '@forestadmin/agent';

      export type ACollectionNameCustomizer = CollectionCustomizer<Schema, 'aCollectionName'>;
      export type ACollectionNameRecord = TPartialRow<Schema, 'aCollectionName'>;
      export type ACollectionNameConditionTree = TConditionTree<Schema, 'aCollectionName'>;
      export type ACollectionNameFilter = TPaginatedFilter<Schema,'aCollectionName'>;
      export type ACollectionNameSortClause = TSortClause<Schema,'aCollectionName'>;
      export type ACollectionNameAggregation = TAggregation<Schema, 'aCollectionName'>;
      
      export type Schema = {
        'aCollectionName': {
          plain: {
            'id': number;
            'boolean': boolean;
            'string': string;
            'point': [number, number];
            'enumWithValues': 'a' | 'b' | 'c';
            'enumWithoutValues': string;
            'complex': { firstname: string; lastname: string };
            'array': Array<string>;
          };
          nested: {};
          flat: {};
        };
      };`;

    expectEqual(generated, expected);
  });

  test('aliaes should work with a collection with underscores', () => {
    const datasource = factories.dataSource.buildWithCollections([
      factories.collection.build({ name: 'a_collection_name' }),
    ]);

    const generated = TypingGenerator.generateTypes(datasource, 5);
    const expected = `
      export type ACollectionNameCustomizer = CollectionCustomizer<Schema, 'a_collection_name'>;
      export type ACollectionNameRecord = TPartialRow<Schema, 'a_collection_name'>;
      export type ACollectionNameConditionTree = TConditionTree<Schema, 'a_collection_name'>;
      export type ACollectionNameFilter = TPaginatedFilter<Schema,'a_collection_name'>;
      export type ACollectionNameSortClause = TSortClause<Schema,'a_collection_name'>;
      export type ACollectionNameAggregation = TAggregation<Schema, 'a_collection_name'>;
    `;

    expectContains(generated, expected);
  });

  const cases = [
    [' white spaces ', "' white spaces '"],
    ['-dashes', "'-dashes'"],
  ];
  test.each(cases)(
    '[%p] should support field name with unconventional characters',
    (fieldName, expectedFieldName) => {
      const datasource = factories.dataSource.buildWithCollections([
        factories.collection.build({
          name: 'aCollectionName',
          schema: {
            fields: {
              [fieldName]: factories.columnSchema.build({ columnType: 'String' }),
            },
          },
        }),
      ]);

      const generated = TypingGenerator.generateTypes(datasource, 5);
      const expected = `
      export type Schema = {
        'aCollectionName': {
          plain: { ${expectedFieldName}:string; };
          nested: {};
          flat: {};
        };
      };`;

      expectContains(generated, expected);
    },
  );

  const casesCollection = [
    [' white spaces ', "' white spaces '"],
    ['-dashes', "'-dashes'"],
  ];
  test.each(casesCollection)(
    '[%p] should support collection name with unconventional characters',
    (collectionName, expectedCollectionName) => {
      const datasource = factories.dataSource.buildWithCollections([
        factories.collection.build({ name: collectionName }),
      ]);

      const generated = TypingGenerator.generateTypes(datasource, 5);
      const expected = `
      export type Schema = {
        ${expectedCollectionName}: {
          plain: {};
          nested: {};
          flat: {};
        };
      };`;

      expectContains(generated, expected);
    },
  );

  test('should work with a cycle (self-reference)', () => {
    const datasource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'col1',
        schema: {
          fields: {
            id: factories.columnSchema.build({ columnType: 'Number' }),
            col1: factories.manyToOneSchema.build({ foreignCollection: 'col1', foreignKey: 'id' }),
          },
        },
      }),
    ]);

    const generated = TypingGenerator.generateTypes(datasource, 5);
    const expected = `
      export type Schema = {
        'col1': {
          plain: { 
            'id': number;
          };
          nested: {
            'col1': Schema['col1']['plain'] & Schema['col1']['nested'];
          };
          flat: {
            'col1:id': number;
            'col1:col1:id': number;
            'col1:col1:col1:id': number;
            'col1:col1:col1:col1:id': number;
            'col1:col1:col1:col1:col1:id': number;
          };
        };
      };`;

    expectContains(generated, expected);
  });

  test('should work with a cycle (inverse)', () => {
    const datasource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'col1',
        schema: {
          fields: {
            id: factories.columnSchema.build({ columnType: 'Number' }),
            col2: factories.manyToOneSchema.build({ foreignCollection: 'col2', foreignKey: 'id' }),
          },
        },
      }),
      factories.collection.build({
        name: 'col2',
        schema: {
          fields: {
            id: factories.columnSchema.build({ columnType: 'Number' }),
            col1: factories.oneToOneSchema.build({ foreignCollection: 'col1', originKey: 'id' }),
          },
        },
      }),
    ]);

    const generated = TypingGenerator.generateTypes(datasource, 5);
    const expected = `
      export type Schema = {
        'col1': {
          plain: {
            'id': number;
          };
          nested: {
            'col2': Schema['col2']['plain'] & Schema['col2']['nested'];
          };
          flat: {
            'col2:id':number;
          };
        };
        'col2': {
          plain: {
            'id': number;
          };
          nested: {
            'col1': Schema['col1']['plain'] & Schema['col1']['nested'];
          };
          flat: {
            'col1:id':number;
          };
        };
      };`;

    expectContains(generated, expected);
  });

  test('should work with a cycle (A -> B -> C -> A)', () => {
    const datasource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'col1',
        schema: {
          fields: {
            id: factories.columnSchema.build({ columnType: 'Number' }),
            col2: factories.manyToOneSchema.build({ foreignCollection: 'col2', foreignKey: 'id' }),
          },
        },
      }),
      factories.collection.build({
        name: 'col2',
        schema: {
          fields: {
            id: factories.columnSchema.build({ columnType: 'Number' }),
            col3: factories.manyToOneSchema.build({ foreignCollection: 'col3', foreignKey: 'id' }),
          },
        },
      }),
      factories.collection.build({
        name: 'col3',
        schema: {
          fields: {
            id: factories.columnSchema.build({ columnType: 'Number' }),
            col1: factories.manyToOneSchema.build({ foreignCollection: 'col1', foreignKey: 'id' }),
          },
        },
      }),
    ]);

    const generated = TypingGenerator.generateTypes(datasource, 3);
    const expected = `
      export type Schema = {
        'col1': {
          plain: { 
            'id': number;
          };
          nested: {
            'col2': Schema['col2']['plain'] & Schema['col2']['nested'];
          };
          flat: {
            'col2:id': number;
            'col2:col3:id': number;
            'col2:col3:col1:id': number;
          };
        };
        'col2': {
          plain: {
            'id': number;
          };
          nested: {
            'col3': Schema['col3']['plain'] & Schema['col3']['nested'];
          };
          flat: {
            'col3:id': number;
            'col3:col1:id': number;
            'col3:col1:col2:id': number;
          };
        };
        'col3': {
          plain: {
            'id': number;
          };
          nested: {
            'col1': Schema['col1']['plain'] & Schema['col1']['nested'];
          };
          flat: {
            'col1:id': number;
            'col1:col2:id': number;
            'col1:col2:col3:id': number;
          };
        };
      };`;

    expectContains(generated, expected);
  });
});
