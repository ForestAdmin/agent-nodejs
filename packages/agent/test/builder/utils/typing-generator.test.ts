import * as factories from '../../agent/__factories__';
import TypingGenerator from '../../../src/builder/utils/typing-generator';

describe('TypingGenerator', () => {
  test('should work with a single collection', () => {
    const datasource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        schema: {
          fields: {
            id: factories.columnSchema.build({ columnType: 'Number' }),
            boolean: factories.columnSchema.build({ columnType: 'Boolean' }),
            string: factories.columnSchema.build({ columnType: 'String' }),
            point: factories.columnSchema.build({ columnType: 'Point' }),
            enum: factories.columnSchema.build({ columnType: 'Enum', enumValues: ['a', 'b', 'c'] }),

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
      export type Schema = {
        a collection: {
          plain: {
            id: number;
            boolean: boolean;
            string: string;
            point: [number, number];
            enum: 'a' | 'b' | 'c';
            complex: { firstname: string; lastname: string };
            array: Array<string>;
          };
          nested: {};
          flat: {};
        };
      };`;

    expect(generated.replace(/[ \n]+/g, '')).toStrictEqual(expected.replace(/[ \n]+/g, ''));
  });

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
      /* eslint-disable */
      export type Schema = {
        col1: {
          plain: { 
            id: number;
          };
          nested: {
            col1: Schema['col1']['plain'] & Schema['col1']['nested'];
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

    expect(generated.replace(/[ \n]+/g, '')).toStrictEqual(expected.replace(/[ \n]+/g, ''));
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
      /* eslint-disable */
      export type Schema = {
        col1: {
          plain: {
            id: number;
          };
          nested: {
            col2: Schema['col2']['plain'] & Schema['col2']['nested'];
          };
          flat: {
            'col2:id':number;
          };
        };
        col2: {
          plain: {
            id: number;
          };
          nested: {
            col1: Schema['col1']['plain'] & Schema['col1']['nested'];
          };
          flat: {
            'col1:id':number;
          };
        };
      };`;

    expect(generated.replace(/[ \n]+/g, '')).toStrictEqual(expected.replace(/[ \n]+/g, ''));
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
      /* eslint-disable */
      export type Schema = {
        col1: {
          plain: { 
            id: number;
          };
          nested: {
            col2: Schema['col2']['plain'] & Schema['col2']['nested'];
          };
          flat: {
            'col2:id': number;
            'col2:col3:id': number;
            'col2:col3:col1:id': number;
          };
        };
        col2: {
          plain: {
            id: number;
          };
          nested: {
            col3: Schema['col3']['plain'] & Schema['col3']['nested'];
          };
          flat: {
            'col3:id': number;
            'col3:col1:id': number;
            'col3:col1:col2:id': number;
          };
        };
        col3: {
          plain: {
            id: number;
          };
          nested: {
            col1: Schema['col1']['plain'] & Schema['col1']['nested'];
          };
          flat: {
            'col1:id': number;
            'col1:col2:id': number;
            'col1:col2:col3:id': number;
          };
        };
      };`;

    expect(generated.replace(/[ \n]+/g, '')).toStrictEqual(expected.replace(/[ \n]+/g, ''));
  });
});
