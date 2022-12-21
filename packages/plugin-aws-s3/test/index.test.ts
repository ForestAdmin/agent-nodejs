import { DataSourceCustomizer } from '@forestadmin/datasource-customizer';
import { ColumnSchema, DataSource, Projection, Sort } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import { Readable } from 'stream';

import { createFileField } from '../src/index';

const logger = () => {};

const mockSend = jest.fn();
const mockSign = jest.fn();

jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest
    .fn()
    .mockImplementation(opt => ({ send: mockSend, config: { region: opt.region } })),

  // Mock those to the identity function as they are just factories
  DeleteObjectCommand: jest.fn().mockImplementation(r => ({ type: 'DeleteObject', ...r })),
  GetObjectCommand: jest.fn().mockImplementation(r => ({ type: 'GetObject', ...r })),
  PutObjectCommand: jest.fn().mockImplementation(r => ({ type: 'PutObject', ...r })),
}));

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => mockSign(...args),
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

describe('plugin-aws-s3', () => {
  let customizer: DataSourceCustomizer;

  beforeEach(() => {
    jest.clearAllMocks();

    customizer = new DataSourceCustomizer();
    customizer.addDataSource(async () => baseDataSource);
  });

  it('should crash if used on the datasource', async () => {
    await expect(
      customizer
        .use(createFileField, {
          fieldname: 'file',
          aws: { bucket: 'myBucket', region: 'myRegion' },
        })
        .getDataSource(logger),
    ).rejects.toThrow('createFileField can only be used on collections.');
  });

  it('should crash if without options', async () => {
    await expect(
      customizer
        .customizeCollection('books', books => books.use(createFileField))
        .getDataSource(logger),
    ).rejects.toThrow('Options must be provided.');
  });

  it('should crash if used on column with type !== string', async () => {
    await expect(
      customizer
        .customizeCollection('books', books => books.use(createFileField, { fieldname: 'id' }))
        .getDataSource(logger),
    ).rejects.toThrow("The field 'books.id' does not exist or is not a string.");
  });

  describe('when using the default settings', () => {
    let dataSource: DataSource;

    beforeEach(async () => {
      dataSource = await customizer
        .customizeCollection('books', books =>
          books.use(createFileField, {
            fieldname: 'file',
            aws: { bucket: 'myBucket', region: 'myRegion' },
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
      mockSign.mockImplementationOnce(() => '[[signed-url-mock]]');

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

      // Should return the signed url
      expect(records[0]).toHaveProperty('file', '[[signed-url-mock]]');

      // Should have called the signer
      expect(mockSign).toHaveBeenCalledWith(
        expect.anything(),
        { type: 'GetObject', Bucket: 'myBucket', Key: 'myKey' },
        { expiresIn: 300 },
      );
    });

    test('update should decode the url, and upload the new version', async () => {
      await dataSource
        .getCollection('books')
        .update(factories.caller.build(), factories.filter.build(), {
          id: 1,
          file: 'data:text/plain;name=myfile.txt;charset=utf-8;base64,SGVsbG8gV29ybGQ=',
        });

      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({
          ACL: 'private',
          Body: Buffer.from('Hello World'),
          Bucket: 'myBucket',
          ContentType: 'text/plain',
          Key: 'books/1/myfile.txt',
        }),
      );

      expect(baseDataSource.getCollection('books').update).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { id: 1, file: 'books/1/myfile.txt' },
      );
    });
  });

  describe('when using a required field for the path', () => {
    test('schema should contain the validator', async () => {
      const options = {
        fieldname: 'mandatoryFile',
        aws: { bucket: 'myBucket', region: 'myRegion' },
      };
      const dataSource = await customizer
        .customizeCollection('books', books => books.use(createFileField, options))
        .getDataSource(logger);

      const schema = dataSource.getCollection('books').schema.fields.mandatoryFile as ColumnSchema;

      expect(schema).toMatchObject({
        validation: [{ operator: 'Present' }],
      });
    });
  });

  describe('when using acl = public-read', () => {
    let dataSource: DataSource;

    beforeEach(async () => {
      dataSource = await customizer
        .customizeCollection('books', books =>
          books.use(createFileField, {
            fieldname: 'file',
            aws: { bucket: 'myBucket', region: 'myRegion' },
            acl: 'public-read',
          }),
        )
        .getDataSource(logger);
    });

    test('list should not sign the urls', async () => {
      mockSend.mockResolvedValue({
        Body: Readable.from(Buffer.from('Hello World')),
        ContentType: 'text/plain',
      });

      const records = await dataSource
        .getCollection('books')
        .list(factories.caller.build(), factories.filter.build(), new Projection('id', 'file'));

      expect(records[0]).toHaveProperty('file', 'https://myBucket.s3.myRegion.amazonaws.com/myKey');
      expect(records[1]).toHaveProperty('file', null);
    });
  });

  describe('when using readmode = proxy', () => {
    let dataSource: DataSource;

    beforeEach(async () => {
      dataSource = await customizer
        .customizeCollection('books', books =>
          books.use(createFileField, {
            fieldname: 'file',
            aws: { bucket: 'myBucket', region: 'myRegion' },
            readMode: 'proxy',
          }),
        )
        .getDataSource(logger);
    });

    test('list should fetch the files from s3', async () => {
      mockSend.mockResolvedValue({
        Body: Readable.from(Buffer.from('Hello World')),
        ContentType: 'text/plain',
      });

      const records = await dataSource
        .getCollection('books')
        .list(factories.caller.build(), factories.filter.build(), new Projection('id', 'file'));

      // There is only one non-null file => we should have called the s3 client once
      expect(mockSend).toHaveBeenCalledTimes(1);

      // Should load the file
      expect(mockSend).toHaveBeenCalledWith({
        type: 'GetObject',
        Bucket: 'myBucket',
        Key: 'myKey',
      });

      // The file should be returned as a data url
      expect(records[0]).toHaveProperty(
        'file',
        'data:text/plain;name=myKey;base64,SGVsbG8gV29ybGQ=',
      );

      // The null case should work too
      expect(records[1]).toHaveProperty('file', null);
    });
  });

  describe('when using delete = true', () => {
    let dataSource: DataSource;

    beforeEach(async () => {
      dataSource = await customizer
        .customizeCollection('books', books =>
          books.use(createFileField, {
            fieldname: 'file',
            aws: { bucket: 'myBucket', region: 'myRegion' },
            deleteFiles: true,
          }),
        )
        .getDataSource(logger);
    });

    test('update to null should delete the files from s3', async () => {
      await dataSource
        .getCollection('books')
        .update(factories.caller.build(), factories.filter.build(), { file: null });

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith({
        type: 'DeleteObject',
        Bucket: 'myBucket',
        Key: 'myKey',
      });
    });

    test('delete should delete the files from s3', async () => {
      await dataSource
        .getCollection('books')
        .delete(factories.caller.build(), factories.filter.build());

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith({
        type: 'DeleteObject',
        Bucket: 'myBucket',
        Key: 'myKey',
      });
    });
  });
});
