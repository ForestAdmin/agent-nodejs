/* eslint-disable no-underscore-dangle */
import { ConditionTreeLeaf, Filter } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import { Connection, Types } from 'mongoose';

import setupFlattener from './_build-models';
import MongooseDatasource from '../../../src/datasource';

describe('Complex flattening', () => {
  const caller = factories.caller.build();
  let connection: Connection;

  afterEach(async () => {
    await connection?.close();
  });

  it('work when creating items using asFields and asModels', async () => {
    connection = await setupFlattener('collection_flattener_create');
    const dataSource = new MongooseDatasource(connection, {
      flattenMode: 'manual',
      flattenOptions: {
        cars: {
          asFields: ['engine'],
          asModels: ['engine.companies', 'engine.comments', 'testNotDeep'],
        },
        companies: { asFields: ['address'] },
      },
    });

    const [company] = await dataSource
      .getCollection('companies')
      .create(caller, [{ name: 'my company', address: { street: 'my street' } }]);

    const [car] = await dataSource.getCollection('cars').create(caller, [
      {
        name: 'my fiesta',
        wheelSize: 12,
        'engine@@@identification@@@manufacturer': 'Toyota',
        'engine@@@identification@@@date': '2010-01-01T00:00:00.000Z',
        'engine@@@identification@@@company': company._id,
        'engine@@@fuel@@@capacity': 12,
        'engine@@@fuel@@@category': 'EXPLOSION',
        'engine@@@horsePower': '12',
        'engine@@@owner': company._id,
        company: company._id,
      },
    ]);

    const comments = await dataSource.getCollection('cars_engine_comments').create(caller, [
      { parentId: car._id, date: '2010-01-01', comment: 'my comment' },
      { parentId: car._id, date: '2020-01-01', comment: 'my comment 2' },
    ]);

    const doc = await connection.model('cars').findOne({ _id: car._id });

    expect(car).toEqual(
      expect.objectContaining({
        _id: expect.any(String),
        'engine@@@identification@@@manufacturer': 'Toyota',
        'engine@@@identification@@@date': '2010-01-01T00:00:00.000Z',
        'engine@@@identification@@@company': company._id,
      }),
    );

    expect(comments).toEqual([
      expect.objectContaining({ _id: `${car._id}.engine.comments.0` }),
      expect.objectContaining({ _id: `${car._id}.engine.comments.1` }),
    ]);

    expect(doc).toEqual(
      expect.objectContaining({
        name: 'my fiesta',
        wheelSize: 12,
        engine: expect.objectContaining({
          identification: expect.objectContaining({
            manufacturer: 'Toyota',
            date: new Date('2010-01-01T00:00:00.000Z'),
            company: new Types.ObjectId(company._id),
          }),
          fuel: expect.objectContaining({ capacity: 12, category: 'EXPLOSION' }),
          horsePower: '12',
          owner: new Types.ObjectId(company._id),
          comments: [
            expect.objectContaining({ comment: 'my comment' }),
            expect.objectContaining({ comment: 'my comment 2' }),
          ],
        }),
        company: new Types.ObjectId(company._id),
      }),
    );
  });

  it('work when creating items using nested asModels', async () => {
    connection = await setupFlattener('collection_flattener_create');

    const dataSource = new MongooseDatasource(connection, {
      asModels: { cars: ['engine', 'engine.fuel'] },
    });

    const [car] = await dataSource
      .getCollection('cars')
      .create(caller, [{ name: 'my fiesta', wheelSize: 12 }]);

    await dataSource
      .getCollection('cars_engine')
      .update(
        caller,
        new Filter({ conditionTree: new ConditionTreeLeaf('parentId', 'Equal', car._id) }),
        { horsePower: '12' },
      );

    await dataSource
      .getCollection('cars_engine_fuel')
      .update(
        caller,
        new Filter({ conditionTree: new ConditionTreeLeaf('parent:parentId', 'Equal', car._id) }),
        { capacity: 12, category: 'EXPLOSION' },
      );

    const doc = await connection.model('cars').findOne({ _id: car._id });

    expect(doc).toEqual(
      expect.objectContaining({
        name: 'my fiesta',
        wheelSize: 12,
        engine: expect.objectContaining({
          horsePower: '12',
          fuel: expect.objectContaining({ capacity: 12, category: 'EXPLOSION' }),
        }),
      }),
    );
  });

  /** @see https://community.forestadmin.com/t/bug-report-with-smart-models-on-node-js-agent/6480/6 */
  it('should work when creating a submodel with nested fields', async () => {
    const flatRecord = {
      date: '2010-01-01T00:00:00.000Z',
      comment: 'hi!',
      'nested@@@subNested': 'hi!',
      'nested@@@subNested2': 'hi!',
    };

    connection = await setupFlattener('collection_flattener_create');

    const dataSource = new MongooseDatasource(connection, {
      flattenMode: 'manual',
      flattenOptions: {
        cars: {
          asFields: ['engine.comments.nested'],
          asModels: ['engine.comments'],
        },
      },
    });

    const [car] = await dataSource.getCollection('cars').create(caller, [{ name: 'my fiesta' }]);
    const [carCommentFromApp] = await dataSource
      .getCollection('cars_engine_comments')
      .create(caller, [{ parentId: car._id, ...flatRecord }]);

    const carSeenFromDb = await connection.model('cars').findOne({ _id: car._id });

    expect(carCommentFromApp).toMatchObject(flatRecord);
    expect(carSeenFromDb.engine.comments[0]).toEqual(
      expect.objectContaining({
        date: expect.any(Date),
        comment: 'hi!',
        nested: { subNested: 'hi!', subNested2: 'hi!' },
      }),
    );
  });

  it('should create a model', async () => {
    connection = await setupFlattener('collection_flattener_create');

    const dataSource = new MongooseDatasource(connection, {
      asModels: { cars: ['engine', 'engine.fuel'] },
    });

    const [car] = await dataSource
      .getCollection('cars')
      .create(caller, [{ name: 'my fiesta', wheelSize: 12 }]);

    const result = await dataSource
      .getCollection('cars_engine')
      .create(caller, [{ parentId: car._id, horsePower: '12' }]);

    const doc = await connection.model('cars').findOne({ _id: car._id });

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          horsePower: '12',
        }),
      ]),
    );

    expect(doc).toEqual(
      expect.objectContaining({
        name: 'my fiesta',
        wheelSize: 12,
        engine: expect.objectContaining({
          horsePower: '12',
        }),
      }),
    );
  });

  it('should throw an error when creating a model with an empty list of elements', async () => {
    connection = await setupFlattener('collection_flattener_create');

    const dataSource = new MongooseDatasource(connection, {
      asModels: { cars: ['engine', 'engine.fuel'] },
    });

    await dataSource.getCollection('cars').create(caller, [{ name: 'my fiesta', wheelSize: 12 }]);

    await expect(dataSource.getCollection('cars_engine').create(caller, [])).rejects.toThrow(
      'Trying to create without data',
    );
  });

  it('should throw an error when creating multiple objects in an object model', async () => {
    connection = await setupFlattener('collection_flattener_create');

    const dataSource = new MongooseDatasource(connection, {
      asModels: { cars: ['engine', 'engine.fuel'] },
    });

    const [car] = await dataSource
      .getCollection('cars')
      .create(caller, [{ name: 'my fiesta', wheelSize: 12 }]);

    await dataSource.getCollection('cars').create(caller, [{ name: 'my fiesta', wheelSize: 12 }]);

    await expect(
      dataSource.getCollection('cars_engine').create(caller, [
        { parentId: car._id, horsePower: '12' },
        { parentId: car._id, horsePower: '13' },
      ]),
    ).rejects.toThrow('Trying to create multiple subrecords at once');
  });
});
