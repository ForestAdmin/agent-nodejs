/* eslint-disable no-underscore-dangle */
import { ConditionTreeLeaf, Filter } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import { Connection, Types } from 'mongoose';

import MongooseDatasource from '../../../src/datasource';
import { setupFlattener } from '../_build-models';

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

  it('creating a subModel should fail', async () => {
    connection = await setupFlattener('collection_flattener_create');

    const dataSource = new MongooseDatasource(connection, {
      asModels: { cars: ['engine', 'engine.fuel'] },
    });

    const [car] = await dataSource
      .getCollection('cars')
      .create(caller, [{ name: 'my fiesta', wheelSize: 12 }]);

    await expect(
      dataSource
        .getCollection('cars_engine')
        .create(caller, [{ parentId: car._id, horsePower: '12' }]),
    ).rejects.toThrow('Trying to create subrecords on a non-array field');
  });
});
