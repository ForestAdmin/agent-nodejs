import { FirebaseCollection, FirebaseDataSource } from '../src';

describe('FirebaseCollection', () => {
  it('should allow to create a collection', () => {
    const datasource = {} as unknown as FirebaseDataSource;
    const collection = FirebaseCollection.create({ name: 'test', datasource, schema: {} });
    expect(collection).toBeInstanceOf(FirebaseCollection);
  });

  describe('create', () => {
    it('should throw an error', async () => {
      const datasource = {} as unknown as FirebaseDataSource;
      const collection = FirebaseCollection.create({ name: 'test', datasource, schema: {} });

      await expect(collection.create()).rejects.toEqual(new Error('Method not implemented.'));
    });
  });

  describe('list', () => {
    it('should throw an error', async () => {
      const datasource = {} as unknown as FirebaseDataSource;
      const collection = FirebaseCollection.create({ name: 'test', datasource, schema: {} });

      await expect(collection.list()).rejects.toEqual(new Error('Method not implemented.'));
    });
  });

  describe('update', () => {
    it('should throw an error', async () => {
      const datasource = {} as unknown as FirebaseDataSource;
      const collection = FirebaseCollection.create({ name: 'test', datasource, schema: {} });

      await expect(collection.update()).rejects.toEqual(new Error('Method not implemented.'));
    });
  });

  describe('delete', () => {
    it('should throw an error', async () => {
      const datasource = {} as unknown as FirebaseDataSource;
      const collection = FirebaseCollection.create({ name: 'test', datasource, schema: {} });

      await expect(collection.delete()).rejects.toEqual(new Error('Method not implemented.'));
    });
  });

  describe('aggregate', () => {
    it('should throw an error', async () => {
      const datasource = {} as unknown as FirebaseDataSource;
      const collection = FirebaseCollection.create({ name: 'test', datasource, schema: {} });

      await expect(collection.aggregate()).rejects.toEqual(new Error('Method not implemented.'));
    });
  });

  describe('static create', () => {
    it('should create a new collection with an id field', () => {
      const collection = FirebaseCollection.create({
        name: 'test',
        datasource: {} as unknown as FirebaseDataSource,
        schema: {},
      });

      expect(collection).toBeDefined();

      expect(collection.schema.fields).toEqual({
        id: {
          columnType: 'String',
          isPrimaryKey: true,
          isSortable: false,
          type: 'Column',
        },
      });
    });

    it('should create a new collection with the provided fields', () => {
      const collection = FirebaseCollection.create({
        name: 'test',
        datasource: {} as unknown as FirebaseDataSource,
        schema: {
          test: {
            columnType: 'String',
            defaultValue: 'test',
            enumValues: ['test', 'foo'],
            isReadOnly: true,
          },
        },
      });

      expect(collection).toBeDefined();

      expect(collection.schema.fields).toEqual({
        id: {
          columnType: 'String',
          isPrimaryKey: true,
          isSortable: false,
          type: 'Column',
        },
        test: {
          columnType: 'String',
          defaultValue: 'test',
          enumValues: ['test', 'foo'],
          isReadOnly: true,
          isPrimaryKey: false,
          isSortable: false,
          type: 'Column',
        },
      });
    });
  });
});
