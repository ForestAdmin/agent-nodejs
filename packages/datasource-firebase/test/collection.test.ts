import { FirebaseCollection, FirebaseDataSource } from '../src';

describe('FirebaseCollection', () => {
  it('should allow to create a collection', () => {
    const datasource = {} as unknown as FirebaseDataSource;
    const collection = new FirebaseCollection('test', datasource);
    expect(collection).toBeInstanceOf(FirebaseCollection);
  });

  describe('create', () => {
    it('should throw an error', async () => {
      const datasource = {} as unknown as FirebaseDataSource;
      const collection = new FirebaseCollection('test', datasource);

      await expect(collection.create()).rejects.toEqual(new Error('Method not implemented.'));
    });
  });

  describe('list', () => {
    it('should throw an error', async () => {
      const datasource = {} as unknown as FirebaseDataSource;
      const collection = new FirebaseCollection('test', datasource);

      await expect(collection.list()).rejects.toEqual(new Error('Method not implemented.'));
    });
  });

  describe('update', () => {
    it('should throw an error', async () => {
      const datasource = {} as unknown as FirebaseDataSource;
      const collection = new FirebaseCollection('test', datasource);

      await expect(collection.update()).rejects.toEqual(new Error('Method not implemented.'));
    });
  });

  describe('delete', () => {
    it('should throw an error', async () => {
      const datasource = {} as unknown as FirebaseDataSource;
      const collection = new FirebaseCollection('test', datasource);

      await expect(collection.delete()).rejects.toEqual(new Error('Method not implemented.'));
    });
  });

  describe('aggregate', () => {
    it('should throw an error', async () => {
      const datasource = {} as unknown as FirebaseDataSource;
      const collection = new FirebaseCollection('test', datasource);

      await expect(collection.aggregate()).rejects.toEqual(new Error('Method not implemented.'));
    });
  });
});
