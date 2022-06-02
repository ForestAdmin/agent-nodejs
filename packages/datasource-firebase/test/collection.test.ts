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

      await expect(collection.create()).rejects.toThrow('Method not implemented.');
    });
  });

  describe('list', () => {
    it('should throw an error', async () => {
      const datasource = {} as unknown as FirebaseDataSource;
      const collection = new FirebaseCollection('test', datasource);

      await expect(collection.list()).rejects.toThrow('Method not implemented.');
    });
  });

  describe('update', () => {
    it('should throw an error', async () => {
      const datasource = {} as unknown as FirebaseDataSource;
      const collection = new FirebaseCollection('test', datasource);

      await expect(collection.update()).rejects.toThrow('Method not implemented.');
    });
  });

  describe('delete', () => {
    it('should throw an error', async () => {
      const datasource = {} as unknown as FirebaseDataSource;
      const collection = new FirebaseCollection('test', datasource);

      await expect(collection.delete()).rejects.toThrow('Method not implemented.');
    });
  });

  describe('aggregate', () => {
    it('should throw an error', async () => {
      const datasource = {} as unknown as FirebaseDataSource;
      const collection = new FirebaseCollection('test', datasource);

      await expect(collection.aggregate()).rejects.toThrow('Method not implemented.');
    });
  });
});
