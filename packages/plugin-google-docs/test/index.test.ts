import { DataSourceCustomizer } from '@forestadmin/datasource-customizer';
import { ColumnSchema, DataSource, Projection, Sort } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import { createGoogleDocsField } from '../src/index';

const logger = () => {};

const mockDocuments = { create: jest.fn(), get: jest.fn(), batchUpdate: jest.fn() };
const mockFiles = { export: jest.fn(), get: jest.fn() };

jest.mock('@googleapis/docs', () => ({
  docs: jest.fn().mockImplementation(opt => ({ documents: mockDocuments, opt })),
}));

jest.mock('@googleapis/drive', () => ({
  drive: jest.fn().mockImplementation(opt => ({ files: mockFiles, opt })),
}));

// This is read only, no need to rebuild for each test
const baseDataSource = factories.dataSource.buildWithCollection(
  factories.collection.build({
    name: 'books',
    list: jest.fn().mockResolvedValue([
      { id: 1, file: 'myKey' }, // simple case
      { id: 2, file: null }, // null case
    ]),
    schema: {
      fields: {
        id: factories.columnSchema.build({
          columnType: 'Number',
          isPrimaryKey: true,
          filterOperators: new Set(['Equal', 'In']),
        }),
        file: factories.columnSchema.build({
          columnType: 'String',
          filterOperators: new Set(['Equal', 'Present']),
          isReadOnly: false,
        }),
        mandatoryFile: factories.columnSchema.build({
          columnType: 'String',
          filterOperators: new Set(['Equal', 'Present']),
          isReadOnly: false,
          validation: [{ operator: 'Present' }],
        }),
      },
    },
  }),
);

describe('plugin-google-docs', () => {
  let customizer: DataSourceCustomizer;

  beforeEach(() => {
    jest.clearAllMocks();

    customizer = new DataSourceCustomizer();
    customizer.addDataSource(async () => baseDataSource);
  });

  it('should crash if used on the datasource', async () => {
    await expect(
      customizer
        .use(createGoogleDocsField, {
          fieldname: 'file',
        })
        .getDataSource(logger),
    ).rejects.toThrow('createGoogleDocsField can only be used on collections.');
  });

  it('should crash if without options', async () => {
    await expect(
      customizer
        .customizeCollection('books', books => books.use(createGoogleDocsField))
        .getDataSource(logger),
    ).rejects.toThrow('Options must be provided.');
  });

  it('should crash if used on column with type !== string', async () => {
    await expect(
      customizer
        .customizeCollection('books', books =>
          books.use(createGoogleDocsField, { fieldname: 'id' }),
        )
        .getDataSource(logger),
    ).rejects.toThrow("The field 'books.id' does not exist or is not a string.");
  });

  describe('when using the default settings', () => {
    let dataSource: DataSource;

    beforeEach(async () => {
      dataSource = await customizer
        .customizeCollection('books', books =>
          books.use(createGoogleDocsField, {
            fieldname: 'file',
            google: { auth: 'YOUR_API_KEY' },
          }),
        )
        .getDataSource(logger);
    });

    test('schema should be valid', () => {
      const schema = dataSource.getCollection('books').schema.fields.file as ColumnSchema;

      expect(schema).toMatchObject({
        columnType: 'String',
        isPrimaryKey: false,
        isReadOnly: false,
        isSortable: true,
        type: 'Column',
      });

      // More operators than expected because of automatic replacement, which can't be disabled.
      // We should at least check that Equal is present
      expect(schema.filterOperators).toContain('Equal');
    });

    test('list should return the field signed', async () => {
      mockFiles.export.mockImplementationOnce(() => Buffer.alloc(8));

      const records = await dataSource.getCollection('books').list(
        factories.caller.build(),
        factories.filter.build({
          conditionTree: factories.conditionTreeLeaf.build({
            field: 'file',
            operator: 'Equal',
            value: 'something',
          }),
          sort: new Sort({ field: 'file', ascending: true }),
        }),
        new Projection('id', 'file'),
      );

      // Should pass filter / sort to the original list
      expect(baseDataSource.getCollection('books').list).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          conditionTree: { field: 'file', operator: 'Equal', value: 'something' },
          sort: [{ ascending: true, field: 'file' }],
        }),
        expect.arrayContaining(['file']),
      );

      // Should return the encoded downloadable file
      expect(records[0]).toHaveProperty('file', 'data:application/pdf;base64,AAAAAAAAAAA=');

      expect(mockFiles.export).toHaveBeenCalledWith({
        fileId: 'myKey',
        mimeType: 'application/pdf',
      });
    });

    test('create docs when creating record', async () => {
      mockDocuments.create.mockResolvedValue({
        data: {
          documentId: 'documentId',
        },
      });
      const caller = factories.caller.build();

      await dataSource.getCollection('books').create(caller, [
        {
          file: 'New title',
        },
      ]);

      expect(baseDataSource.getCollection('books').create).toHaveBeenCalledWith(caller, [
        { file: 'documentId' },
      ]);
    });
  });

  describe('when using title readMode', () => {
    test('list should fetch the files from docs API', async () => {
      const dataSource = await customizer
        .customizeCollection('books', books =>
          books.use(createGoogleDocsField, {
            fieldname: 'file',
            readMode: 'title',
            google: { auth: 'YOUR_API_KEY' },
          }),
        )
        .getDataSource(logger);

      mockDocuments.get.mockResolvedValue({
        data: {
          title: 'Some title',
        },
      });

      const records = await dataSource
        .getCollection('books')
        .list(factories.caller.build(), factories.filter.build(), new Projection('id', 'file'));

      // There is only one non-null file
      expect(mockDocuments.get).toHaveBeenCalledTimes(1);

      // Should load the file
      expect(mockDocuments.get).toHaveBeenCalledWith({
        documentId: 'myKey',
      });

      // The file should be returned as a data url
      expect(records[0]).toHaveProperty('file', 'Some title');

      // The null case should work too
      expect(records[1]).toHaveProperty('file', null);
    });
  });

  describe('when using title webViewLink', () => {
    test('list should fetch the files from drive API', async () => {
      const dataSource = await customizer
        .customizeCollection('books', books =>
          books.use(createGoogleDocsField, {
            fieldname: 'file',
            readMode: 'webViewLink',
            google: { auth: 'YOUR_API_KEY' },
          }),
        )
        .getDataSource(logger);

      mockFiles.get.mockResolvedValue({
        data: {
          webViewLink: 'webViewLink',
        },
      });

      const records = await dataSource
        .getCollection('books')
        .list(factories.caller.build(), factories.filter.build(), new Projection('id', 'file'));

      // There is only one non-null file
      expect(mockFiles.get).toHaveBeenCalledTimes(1);

      // Should load the file
      expect(mockFiles.get).toHaveBeenCalledWith({
        fileId: 'myKey',
      });

      // The file should be returned as a data url
      expect(records[0]).toHaveProperty('file', 'webViewLink');

      // The null case should work too
      expect(records[1]).toHaveProperty('file', null);
    });
  });

  describe('when using title webContentLink', () => {
    test('list should fetch the files from drive API', async () => {
      const dataSource = await customizer
        .customizeCollection('books', books =>
          books.use(createGoogleDocsField, {
            fieldname: 'file',
            readMode: 'webContentLink',
            google: { auth: 'YOUR_API_KEY' },
          }),
        )
        .getDataSource(logger);

      mockFiles.get.mockResolvedValue({
        data: {
          webContentLink: 'webContentLink',
        },
      });

      const records = await dataSource
        .getCollection('books')
        .list(factories.caller.build(), factories.filter.build(), new Projection('id', 'file'));

      // There is only one non-null file
      expect(mockFiles.get).toHaveBeenCalledTimes(1);

      // Should load the file
      expect(mockFiles.get).toHaveBeenCalledWith({
        fileId: 'myKey',
      });

      // The file should be returned as a data url
      expect(records[0]).toHaveProperty('file', 'webContentLink');

      // The null case should work too
      expect(records[1]).toHaveProperty('file', null);
    });
  });

  describe('when using a required field for the path', () => {
    test('schema should contain the validator', async () => {
      const options = {
        fieldname: 'mandatoryFile',
        google: { auth: 'YOUR_API_KEY' },
      };
      const dataSource = await customizer
        .customizeCollection('books', books => books.use(createGoogleDocsField, options))
        .getDataSource(logger);

      const schema = dataSource.getCollection('books').schema.fields.mandatoryFile as ColumnSchema;

      expect(schema).toMatchObject({
        validation: [{ operator: 'Present' }],
      });
    });
  });
});
