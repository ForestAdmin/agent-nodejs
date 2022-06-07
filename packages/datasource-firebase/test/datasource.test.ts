import { Logger } from '@forestadmin/datasource-toolkit';

import { FirebaseCollection, FirebaseDataSource } from '../src';

describe('FirebaseDataSource', () => {
  it('should create a new datasource without a logger', () => {
    const datasource = FirebaseDataSource.create({ schema: {} });
    expect(datasource).toBeInstanceOf(FirebaseDataSource);
  });

  it('should create a new datasource with a logger', () => {
    const logger = {};
    const datasource = FirebaseDataSource.create({
      schema: {},
      logger: logger as unknown as Logger,
    });
    expect(datasource).toBeInstanceOf(FirebaseDataSource);
  });

  describe('static create', () => {
    it('should create a new datasource with its collections', () => {
      const datasource = FirebaseDataSource.create({
        schema: {
          collection1: {},
        },
      });

      expect(datasource).toBeInstanceOf(FirebaseDataSource);
      expect(datasource.collections).toHaveLength(1);
      expect(datasource.collections[0]).toBeInstanceOf(FirebaseCollection);
      expect(datasource.collections[0].name).toBe('collection1');
      expect(datasource.collections[0].schema).toEqual(
        expect.objectContaining({
          fields: {
            id: expect.objectContaining({
              isPrimaryKey: true,
            }),
          },
        }),
      );
    });
  });
});
