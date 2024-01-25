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

    const generated = new TypingGenerator(jest.fn()).generateTypes(datasource, 5);
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
            'array': Array<string> | null;
            'boolean': boolean | null;
            'complex': { 'firstname': string; 'lastname': string } | null;
            'enumWithoutValues': string | null;
            'enumWithValues': 'a' | 'b' | 'c' | null;
            'id': number | null;
            'point': [number, number] | null;
            'string': string | null;
          };
          nested: {};
          flat: {};
        };
      };`;

    expectEqual(generated, expected);
  });

  test('should sort field names', () => {
    const datasource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'aCollectionName',
        schema: {
          fields: {
            b: factories.columnSchema.build({ columnType: 'String' }),
            A: factories.columnSchema.build({ columnType: 'String' }),
            z: factories.columnSchema.build({ columnType: 'String' }),
            a: factories.columnSchema.build({ columnType: 'String' }),
            0: factories.columnSchema.build({ columnType: 'String' }),
          },
        },
      }),
    ]);

    const generated = new TypingGenerator(jest.fn()).generateTypes(datasource, 5);
    const expected = `
      export type Schema = {
        'aCollectionName': {
          plain: {
            '0': string;
            'a': string;
            'A': string;
            'b': string;
            'z': string;
          };
          nested: {};
          flat: {};
        };
      };`;

    expectContains(generated, expected);
  });

  test('should sort nested field names', () => {
    const datasource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'z',
        schema: {
          fields: {
            id: factories.columnSchema.build({ columnType: 'Number' }),
            b: factories.manyToOneSchema.build({ foreignCollection: 'b', foreignKey: 'id' }),
            a: factories.manyToOneSchema.build({ foreignCollection: 'a', foreignKey: 'id' }),
          },
        },
      }),
      factories.collection.build({
        name: 'b',
        schema: {
          fields: {
            id: factories.columnSchema.build({ columnType: 'Number' }),
          },
        },
      }),
      factories.collection.build({
        name: 'a',
        schema: {
          fields: {
            id: factories.columnSchema.build({ columnType: 'Number' }),
          },
        },
      }),
    ]);

    const generated = new TypingGenerator(jest.fn()).generateTypes(datasource, 5);
    const expected = `
      export type Schema = {
        'a': {
          plain: {
            'id': number;
          };
          nested: {};
          flat: {};
        };
        'b': {
          plain: {
            'id': number;
          };
          nested: {};
          flat: {};
        };
        'z': {
          plain: {
            'id': number;
          };
          nested: {
            'a': Schema['a']['plain'] & Schema['a']['nested'];
            'b': Schema['b']['plain'] & Schema['b']['nested'];
          };
          flat: {
            'a:id': number;
            'b:id': number;
          };
        };
      };`;

    expectContains(generated, expected);
  });

  test('should sort enum values', () => {
    const datasource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'aCollectionName',
        schema: {
          fields: {
            enum: factories.columnSchema.build({
              columnType: 'Enum',
              enumValues: ['b', '0', 'z', 'a', 'A'],
            }),
          },
        },
      }),
    ]);

    const generated = new TypingGenerator(jest.fn()).generateTypes(datasource, 5);
    const expected = `
      export type Schema = {
        'aCollectionName': {
          plain: {
            'enum': '0' | 'a' | 'A' | 'b' | 'z';
          };
          nested: {};
          flat: {};
        };
      };`;

    expectContains(generated, expected);
  });

  it.each(['_underscores', '-dashes'])('aliases should work with a collection with %s', char => {
    const datasource = factories.dataSource.buildWithCollections([
      factories.collection.build({ name: `aCollectionNameWith${char}` }),
    ]);
    const replaced = char.replace(/(_|-)/g, '')[0].toUpperCase() + char.slice(2);

    const generated = new TypingGenerator(jest.fn()).generateTypes(datasource, 5);
    const expected = `
      export type ACollectionNameWith${replaced}Customizer = CollectionCustomizer<Schema, 'aCollectionNameWith${char}'>;
      export type ACollectionNameWith${replaced}Record = TPartialRow<Schema, 'aCollectionNameWith${char}'>;
      export type ACollectionNameWith${replaced}ConditionTree = TConditionTree<Schema, 'aCollectionNameWith${char}'>;
      export type ACollectionNameWith${replaced}Filter = TPaginatedFilter<Schema,'aCollectionNameWith${char}'>;
      export type ACollectionNameWith${replaced}SortClause = TSortClause<Schema,'aCollectionNameWith${char}'>;
      export type ACollectionNameWith${replaced}Aggregation = TAggregation<Schema, 'aCollectionNameWith${char}'>;
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

      const generated = new TypingGenerator(jest.fn()).generateTypes(datasource, 5);
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

      const generated = new TypingGenerator(jest.fn()).generateTypes(datasource, 5);
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

    const generated = new TypingGenerator(jest.fn()).generateTypes(datasource, 5);
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

    const generated = new TypingGenerator(jest.fn()).generateTypes(datasource, 5);
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

    const generated = new TypingGenerator(jest.fn()).generateTypes(datasource, 3);
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

  test('it should stop generating fields where there are too many of them', () => {
    const datasource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'col1',
        schema: {
          fields: {
            id: factories.columnSchema.build({ columnType: 'Number' }),
            ...new Array(100).fill(0).reduce(
              (acc, _, i) => ({
                ...acc,
                [`field${i}`]: factories.columnSchema.build({ columnType: 'String' }),
              }),
              {},
            ),
            col2: factories.manyToOneSchema.build({ foreignCollection: 'col2', foreignKey: 'id' }),
          },
        },
      }),
      factories.collection.build({
        name: 'col2',
        schema: {
          fields: {
            id: factories.columnSchema.build({ columnType: 'Number' }),
            ...new Array(100).fill(0).reduce(
              (acc, _, i) => ({
                ...acc,
                [`field${i}`]: factories.columnSchema.build({ columnType: 'String' }),
              }),
              {},
            ),
            col1: factories.oneToOneSchema.build({ foreignCollection: 'col1', originKey: 'id' }),
          },
        },
      }),
    ]);

    const logger = jest.fn();

    const generated = new TypingGenerator(logger, { maxFieldsCount: 2 }).generateTypes(
      datasource,
      5,
    );
    const expected = `
      flat: {
        'col1:field0': string;
        'col1:field1': string;
      };
    `;

    expectContains(generated, expected);
    expect(logger).toHaveBeenCalledWith(
      'Warn',
      `Fields generation stopped on collection col1, ` +
        `try using a lower typingsMaxDepth (5) to avoid this issue.`,
    );
  });

  test('should sort alphabetically plain, nested and flat properties', () => {
    const datasource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'col1',
        schema: {
          fields: {
            zebra: factories.manyToOneSchema.build({
              foreignCollection: 'col1',
              foreignKey: 'id',
            }),
            marsAttack: factories.columnSchema.build({ columnType: 'String' }),
            zebraCount: factories.columnSchema.build({ columnType: 'Number' }),
            animalsCount: factories.columnSchema.build({ columnType: 'Number' }),
          },
        },
      }),
    ]);

    const generated = new TypingGenerator(jest.fn()).generateTypes(datasource, 5);
    const expected = `
      export type Schema = {
        'col1': {
          plain: {
            'animalsCount': number;
            'marsAttack': string;
            'zebraCount': number;
          };
          nested: {
            'zebra': Schema['col1']['plain'] & Schema['col1']['nested'];
          };
          flat: {
            'zebra:animalsCount': number;
            'zebra:marsAttack': string;
            'zebra:zebraCount': number;
            'zebra:zebra:animalsCount': number;
            'zebra:zebra:marsAttack': string;
            'zebra:zebra:zebraCount': number;
            'zebra:zebra:zebra:animalsCount': number;
            'zebra:zebra:zebra:marsAttack': string;
            'zebra:zebra:zebra:zebraCount': number;
            'zebra:zebra:zebra:zebra:animalsCount': number;
            'zebra:zebra:zebra:zebra:marsAttack': string;
            'zebra:zebra:zebra:zebra:zebraCount': number;
            'zebra:zebra:zebra:zebra:zebra:animalsCount': number;
            'zebra:zebra:zebra:zebra:zebra:marsAttack': string;
            'zebra:zebra:zebra:zebra:zebra:zebraCount': number;
          };
        };
      };`;

    expectContains(generated, expected);
  });
});
