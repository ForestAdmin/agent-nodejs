/* eslint-disable no-underscore-dangle */
import type { Connection } from 'mongoose';

import { ConditionTreeLeaf, Filter, Projection } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import setupFlattener from './_build-models';
import MongooseDatasource from '../../../src/datasource';

describe('Complex flattening', () => {
  const caller = factories.caller.build();
  let connection: Connection;

  afterEach(async () => {
    await connection?.close();
  });

  it('filter on flattened field should work', async () => {
    connection = await setupFlattener('collection_flattener_list');
    const dataSource = new MongooseDatasource(connection, { flattenMode: 'auto' });
    const cars = dataSource.getCollection('cars');

    // Create (using our api, why not)
    const [car] = await cars.create(caller, [
      {
        name: 'my fiesta',
        wheelSize: 12,
        'engine@@@identification@@@manufacturer': 'Toyota',
        'engine@@@identification@@@date': '2010-01-01T00:00:00.000Z',
        'engine@@@fuel@@@capacity': 12,
        'engine@@@fuel@@@category': 'EXPLOSION',
        'engine@@@horsePower': '98',
      },
    ]);

    // filter on flattened field
    const records = await cars.list(
      caller,
      new Filter({
        conditionTree: new ConditionTreeLeaf(
          'engine@@@identification@@@manufacturer',
          'Equal',
          'Toyota',
        ),
      }),
      new Projection('_id'),
    );

    expect(records).toEqual([expect.objectContaining({ _id: car._id })]);

    // filter on flattened field
    const noRecords = await cars.list(
      caller,
      new Filter({
        conditionTree: new ConditionTreeLeaf(
          'engine@@@identification@@@manufacturer',
          'Equal',
          'Renault',
        ),
      }),
      new Projection('_id'),
    );

    expect(noRecords).toEqual([]);
  });

  it('filter when mixing virtual models and flattening should work', async () => {
    connection = await setupFlattener('collection_flattener_list');
    const dataSource = new MongooseDatasource(connection, {
      flattenMode: 'manual',
      flattenOptions: {
        cars: { asFields: ['engine.identification', 'engine.fuel'], asModels: ['engine'] },
      },
    });

    // Create (using our api, why not)
    const [car] = await dataSource
      .getCollection('cars')
      .create(caller, [{ name: 'my fiesta', wheelSize: 12 }]);

    await dataSource
      .getCollection('cars_engine')
      .update(
        caller,
        new Filter({ conditionTree: new ConditionTreeLeaf('parentId', 'Equal', car._id) }),
        {
          parentId: car._id,
          'identification@@@manufacturer': 'Toyota',
          'identification@@@date': '2010-01-01T00:00:00.000Z',
          'fuel@@@capacity': 12,
          'fuel@@@category': 'EXPLOSION',
          horsePower: '98',
        },
      );

    const records = await dataSource.getCollection('cars').list(
      caller,
      new Filter({
        conditionTree: new ConditionTreeLeaf('engine:_id', 'Equal', `${car._id}.engine`),
      }),
      new Projection('_id'),
    );

    expect(records).toEqual([expect.objectContaining({ _id: car._id })]);

    const moreRecords = await dataSource
      .getCollection('cars_engine')
      .list(
        caller,
        new Filter({ conditionTree: new ConditionTreeLeaf('parent:_id', 'Equal', car._id) }),
        new Projection('_id'),
      );

    expect(moreRecords).toEqual([expect.objectContaining({ _id: `${car._id}.engine` })]);
  });

  describe('asModels', () => {
    describe('used on an object field', () => {
      it('should correctly retrieve fields on the flattened model', async () => {
        connection = await setupFlattener('collection_flattener_list');
        const dataSource = new MongooseDatasource(connection, {
          flattenMode: 'manual',
          flattenOptions: { cars: { asModels: ['engine'] } },
        });

        const [car] = await dataSource
          .getCollection('cars')
          .create(caller, [{ name: 'my fiesta', wheelSize: 12, engine: { horsePower: 98 } }]);

        const records = await dataSource.getCollection('cars').list(
          caller,
          new Filter({
            conditionTree: new ConditionTreeLeaf('_id', 'Equal', `${car._id}`),
          }),
          new Projection('_id', 'engine:horsePower'),
        );

        expect(records).toEqual([
          expect.objectContaining({
            _id: car._id,
            engine: { horsePower: '98' },
          }),
        ]);
      });

      it('should correctly retrieve one nested record', async () => {
        connection = await setupFlattener('collection_flattener_list');
        const dataSource = new MongooseDatasource(connection, {
          flattenMode: 'manual',
          flattenOptions: {
            cars: { asModels: ['engine'] },
          },
        });

        const [car] = await dataSource
          .getCollection('cars')
          .create(caller, [{ name: 'my fiesta', wheelSize: 12, engine: { horsePower: 98 } }]);

        const records = await dataSource.getCollection('cars_engine').list(
          caller,
          new Filter({
            conditionTree: new ConditionTreeLeaf('_id', 'Equal', `${car._id}.engine`),
          }),
          new Projection('_id', 'horsePower', 'parentId', 'parent:_id', 'parent:engine:horsePower'),
        );

        expect(records).toEqual([
          expect.objectContaining({
            horsePower: '98',
            parent: { _id: car._id, engine: { horsePower: '98' } },
          }),
        ]);
      });

      it('should not retrieve records for children models when the value is null', async () => {
        connection = await setupFlattener('collection_flattener_list');
        const dataSource = new MongooseDatasource(connection, {
          flattenMode: 'manual',
          flattenOptions: { companies: { asModels: ['address'] } },
        });

        const [company] = await dataSource
          .getCollection('companies')
          .create(caller, [{ name: 'Renault' }]);

        const records = await dataSource.getCollection('companies_address').list(
          caller,
          new Filter({
            conditionTree: new ConditionTreeLeaf('parent:_id', 'Equal', `${company._id}`),
          }),
          new Projection('_id', 'horsePower', 'parentId', 'parent:_id', 'parent:address:city'),
        );

        expect(records).toEqual([]);
      });

      it('should return records even if flatten field is empty', async () => {
        connection = await setupFlattener('collection_flattener_list');
        const dataSource = new MongooseDatasource(connection, {
          flattenMode: 'manual',
          flattenOptions: { companies: { asModels: ['address'] } },
        });

        await dataSource.getCollection('companies').create(caller, [{ name: 'Renault' }]);

        const records = await dataSource
          .getCollection('companies')
          .list(caller, new Filter({}), new Projection('_id'));

        expect(records).toEqual([{ _id: expect.any(String) }]);
      });

      it('should return null when asking a flattened field that does not exist', async () => {
        connection = await setupFlattener('collection_flattener_list');
        const dataSource = new MongooseDatasource(connection, {
          flattenMode: 'manual',
          flattenOptions: { companies: { asModels: ['address'] } },
        });

        await dataSource.getCollection('companies').create(caller, [{ name: 'Renault' }]);

        const records = await dataSource
          .getCollection('companies')
          .list(caller, new Filter({}), new Projection('_id', 'address:city'));

        // expected address null, not an empty object
        expect(records).toEqual([{ _id: expect.any(String), address: null }]);
      });

      it('should return a value when asking a flattened field with that exist', async () => {
        connection = await setupFlattener('collection_flattener_list');
        const dataSource = new MongooseDatasource(connection, {
          flattenMode: 'manual',
          flattenOptions: { companies: { asModels: ['address'] } },
        });

        await dataSource
          .getCollection('companies')
          .create(caller, [{ name: 'Renault', address: { city: 'Paris' } }]);

        const records = await dataSource
          .getCollection('companies')
          .list(caller, new Filter({}), new Projection('_id', 'address:city'));

        expect(records).toEqual([{ _id: expect.any(String), address: { city: 'Paris' } }]);
      });

      it('should not return the record when only asking the flattened field that does not exist', async () => {
        connection = await setupFlattener('collection_flattener_list');
        const dataSource = new MongooseDatasource(connection, {
          flattenMode: 'manual',
          flattenOptions: { companies: { asModels: ['address'] } },
        });

        await dataSource.getCollection('companies').create(caller, [{ name: 'Renault' }]);

        const records = await dataSource
          .getCollection('companies_address')
          .list(caller, new Filter({}), new Projection('city'));

        expect(records).toEqual([]);
      });

      it('should return the record when asking the flattened field that exists', async () => {
        connection = await setupFlattener('collection_flattener_list');
        const dataSource = new MongooseDatasource(connection, {
          flattenMode: 'manual',
          flattenOptions: { companies: { asModels: ['address'] } },
        });

        await dataSource.getCollection('companies').create(caller, [
          {
            name: 'Renault',
            address: { city: null, number: 10 },
          },
        ]);

        const records = await dataSource
          .getCollection('companies_address')
          .list(caller, new Filter({}), new Projection('city'));

        expect(records).toEqual([{ city: null }]);
      });

      it('should return the record with nested field when asking a null field from an existing flattened field', async () => {
        connection = await setupFlattener('collection_flattener_list');
        const dataSource = new MongooseDatasource(connection, {
          flattenMode: 'manual',
          flattenOptions: { companies: { asModels: ['address'] } },
        });

        await dataSource.getCollection('companies').create(caller, [
          {
            name: 'Renault',
            address: { city: null, number: 10 },
          },
        ]);

        const records = await dataSource
          .getCollection('companies')
          .list(caller, new Filter({}), new Projection('name', 'address:city'));

        expect(records).toEqual([{ name: 'Renault', address: { city: null } }]);
      });

      it('should return null when asking null deep flattened field that not exist', async () => {
        connection = await setupFlattener('collection_flattener_list');
        const dataSource = new MongooseDatasource(connection, {
          flattenMode: 'manual',
          flattenOptions: { assets: { asModels: ['image', 'image.metadata'] } },
        });

        await dataSource.getCollection('assets').create(caller, [
          {
            name: 'dog',
            image: { path: 'dog', metadata: null },
          },
        ]);

        const records = await dataSource
          .getCollection('assets')
          .list(caller, new Filter({}), new Projection('name', 'image:metadata:size'));

        expect(records).toEqual([{ name: 'dog', image: { metadata: null } }]);
      });

      it('should return the record when asking null deep flattened field that exist', async () => {
        connection = await setupFlattener('collection_flattener_list');
        const dataSource = new MongooseDatasource(connection, {
          flattenMode: 'manual',
          flattenOptions: { assets: { asModels: ['image', 'image.metadata'] } },
        });

        await dataSource.getCollection('assets').create(caller, [
          {
            name: 'dog',
            image: { path: 'dog', metadata: { format: 'jpeg' } },
          },
        ]);

        const records = await dataSource
          .getCollection('assets')
          .list(caller, new Filter({}), new Projection('name', 'image:metadata:size'));

        expect(records).toEqual([{ name: 'dog', image: { metadata: { size: null } } }]);
      });
    });
  });
});
