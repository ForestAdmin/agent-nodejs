/* eslint-disable no-underscore-dangle */
import { Filter, ValidationError } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import { Connection } from 'mongoose';

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
    const dataSource = new MongooseDatasource(connection, { flattenMode: 'auto' });

    // Create (using our api, why not)
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

    await dataSource.getCollection('cars_engine_comments').create(caller, [
      { parentId: car._id, date: '2010-01-01', comment: 'my comment' },
      { parentId: car._id, date: '2020-01-01', comment: 'my comment 2' },
    ]);

    // Update flattened fields
    await dataSource.getCollection('cars').update(caller, new Filter({}), {
      'engine@@@horsePower': '13',
      'engine@@@identification@@@manufacturer': 'Renault',
    });

    // Update fields on virtual model
    await dataSource.getCollection('cars_engine_comments').update(caller, new Filter({}), {
      comment: 'my new comment',
    });

    // attempt to reparent virtual model

    await expect(() =>
      dataSource.getCollection('cars_engine_comments').update(caller, new Filter({}), {
        parentId: 'something new',
      }),
    ).rejects.toThrow(ValidationError);

    const doc = await connection.model('cars').findOne({ _id: car._id });

    expect(doc).toEqual(
      expect.objectContaining({
        engine: expect.objectContaining({
          // Check that manufacturer was updated
          identification: expect.objectContaining({ manufacturer: 'Renault' }),
          // Check that horsePower was updated
          horsePower: '13',
          // Check that comments were updated
          comments: [
            expect.objectContaining({ comment: 'my new comment' }),
            expect.objectContaining({ comment: 'my new comment' }),
          ],
        }),
      }),
    );
  });
});
