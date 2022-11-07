import { DataSourceCustomizer } from '@forestadmin/datasource-customizer';
import { DataSource, FileResult } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import { addExportAdvanced } from '../src/index';

const logger = () => {};

describe('plugin-export-advanced', () => {
  let customizer: DataSourceCustomizer;

  beforeEach(() => {
    customizer = new DataSourceCustomizer();
    customizer.addDataSource(async () =>
      factories.dataSource.buildWithCollections([
        factories.collection.build({
          name: 'books',
          schema: {
            fields: {
              id: factories.columnSchema.numericPrimaryKey().build(),
              title: factories.columnSchema.build({ columnType: 'String' }),
              author: factories.manyToOneSchema.build({
                foreignCollection: 'authors',
                foreignKey: 'id',
              }),
            },
          },
          list: async () => [
            {
              id: 1,
              title: "The Hitchhiker's Guide to the Galaxy, vol 2",
              author: { id: 1, fullname: 'Douglas Adams' },
            },
            {
              id: 2,
              title: 'The Restaurant at the End of the Universe',
              author: null,
            },
          ],
        }),
        factories.collection.build({
          name: 'authors',
          schema: {
            fields: {
              id: factories.columnSchema.numericPrimaryKey().build(),
              fullname: factories.columnSchema.build({ columnType: 'String' }),
            },
          },
        }),
      ]),
    );
  });

  describe('When using the defaults (on collection)', () => {
    let dataSource: DataSource;

    beforeEach(async () => {
      dataSource = await customizer
        .customizeCollection('books', books => books.use(addExportAdvanced))
        .getDataSource(logger);
    });

    test('should create an action which have a dynamic form', async () => {
      const actionSchema = dataSource.getCollection('books').schema.actions;

      expect(actionSchema).toHaveProperty('Export books (advanced)', {
        generateFile: true,
        scope: 'Global',
        staticForm: false,
      });
    });

    test('the form should have all fields', async () => {
      const form = await dataSource
        .getCollection('books')
        .getForm(factories.caller.build(), 'Export books (advanced)');

      expect(form).toEqual([
        {
          label: 'Filename',
          type: 'String',
          value: `books - ${new Date().toISOString().substring(0, 10)}`,
          watchChanges: false,
        },
        {
          enumValues: ['.csv', '.xlsx', '.json'],
          label: 'Format',
          type: 'Enum',
          value: '.csv',
          watchChanges: false,
        },
        {
          enumValues: ['id', 'title', 'author:id', 'author:fullname'],
          label: 'Fields',
          type: 'EnumList',
          value: ['id', 'title', 'author:id', 'author:fullname'],
          watchChanges: true,
        },
      ]);
    });

    test.each([
      ['.csv', 'text/csv'],
      ['.json', 'application/json'],
      ['.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    ])('running the action should export to %s', async (format, mimeType) => {
      const result = await dataSource
        .getCollection('books')
        .execute(factories.caller.build(), 'Export books (advanced)', {
          Format: format,
          Filename: 'file',
          Fields: ['id', 'title', 'author:id', 'author:fullname'],
        });

      expect(result.type).toStrictEqual('File');
      expect((result as FileResult).mimeType).toStrictEqual(mimeType);
      expect((result as FileResult).name).toStrictEqual(`file${format}`);
    });
  });

  describe('When providing settings (on datasource)', () => {
    let dataSource: DataSource;

    beforeEach(async () => {
      dataSource = await customizer
        .use(addExportAdvanced, {
          actionName: 'Export',
          filename: 'output',
          fields: ['id'],
          format: '.csv',
        })
        .getDataSource(logger);
    });

    test('should create an action with the provided name', async () => {
      const actionSchema = dataSource.getCollection('books').schema.actions;

      expect(actionSchema).toHaveProperty('Export', {
        generateFile: true,
        scope: 'Global',
        staticForm: true, // no form here
      });
    });

    test('should not have a form', async () => {
      const form = await dataSource
        .getCollection('books')
        .getForm(factories.caller.build(), 'Export');

      expect(form).toStrictEqual([]);
    });

    test('running the action should export to csv', async () => {
      const result = await dataSource
        .getCollection('books')
        .execute(factories.caller.build(), 'Export', {});

      expect(result.type).toStrictEqual('File');
      expect((result as FileResult).mimeType).toStrictEqual('text/csv');
      expect((result as FileResult).name).toStrictEqual('output.csv');
    });
  });
});
