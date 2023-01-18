import { Connection } from 'mongoose';

import setupFlattener from './_build-models';
import MongooseDatasource from '../../../src/datasource';

describe('Complex flattening', () => {
  let connection: Connection;

  afterEach(async () => {
    await connection?.close();
  });

  it('should find all enums', async () => {
    connection = await setupFlattener('collection_flattener_schema');
    const dataSource = new MongooseDatasource(connection, { flattenMode: 'auto' });

    expect(dataSource.getCollection('cars').schema.fields).toMatchObject({
      'engine@@@identification@@@manufacturer': {
        type: 'Column',
        columnType: 'Enum',
        enumValues: ['Toyota', 'Renault'],
        defaultValue: 'Toyota',
      },
      'engine@@@fuel@@@category': {
        type: 'Column',
        columnType: 'Enum',
        enumValues: ['EXPLOSION', 'ELECTRIC'],
        defaultValue: 'EXPLOSION',
      },
    });
  });

  it('should find all relations', async () => {
    connection = await setupFlattener('collection_flattener_schema');
    const dataSource = new MongooseDatasource(connection, { flattenMode: 'auto' });

    expect(dataSource.getCollection('cars').schema.fields).toMatchObject({
      // Many to ones (explicit ref)
      'engine@@@identification@@@company__manyToOne': {
        type: 'ManyToOne',
        foreignCollection: 'companies',
      },
      'engine@@@owner__manyToOne': { type: 'ManyToOne', foreignCollection: 'companies' },
      company__manyToOne: { type: 'ManyToOne', foreignCollection: 'companies' },

      // One to many
      engine_comments: {
        type: 'OneToMany',
        foreignCollection: 'cars_engine_comments',
        originKey: 'parentId',
      },

      // Many to many towards companies
      companies_through_cars_engine_companies: {
        type: 'ManyToMany',
        throughCollection: 'cars_engine_companies',
      },
      companies_through_cars_testNotDeep: {
        type: 'ManyToMany',
        throughCollection: 'cars_testNotDeep',
      },
    });

    expect(dataSource.getCollection('cars_engine_comments').schema.fields).toMatchObject({
      parent: { type: 'ManyToOne', foreignCollection: 'cars', foreignKey: 'parentId' },
    });

    expect(dataSource.getCollection('cars_engine_companies').schema.fields).toMatchObject({
      parent: { type: 'ManyToOne', foreignCollection: 'cars', foreignKey: 'parentId' },
      content__manyToOne: {
        type: 'ManyToOne',
        foreignCollection: 'companies',
        foreignKey: 'content',
      },
    });

    expect(dataSource.getCollection('cars_testNotDeep').schema.fields).toMatchObject({
      parent: { type: 'ManyToOne', foreignCollection: 'cars', foreignKey: 'parentId' },
      content__manyToOne: {
        type: 'ManyToOne',
        foreignCollection: 'companies',
        foreignKey: 'content',
      },
    });

    expect(dataSource.getCollection('companies').schema.fields).toMatchObject({
      // Natural one to many
      cars_company__manyToOne__inverse: {
        type: 'OneToMany',
        foreignCollection: 'cars',
      },
      'cars_engine@@@identification@@@company__manyToOne__inverse': {
        type: 'OneToMany',
        foreignCollection: 'cars',
      },
      'cars_engine@@@owner__manyToOne__inverse': {
        type: 'OneToMany',
        foreignCollection: 'cars',
      },

      // Inverse many to many
      cars_through_cars_engine_companies: {
        type: 'ManyToMany',
        throughCollection: 'cars_engine_companies',
        foreignCollection: 'cars',
      },

      cars_through_cars_testNotDeep: {
        type: 'ManyToMany',
        throughCollection: 'cars_testNotDeep',
        foreignCollection: 'cars',
      },
    });
  });
});
