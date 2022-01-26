import { Sequelize } from 'sequelize';
import sortBy from 'lodash/sortby';

import { CollectionSchema, Operator } from '@forestadmin/datasource-toolkit';
import LiveCollection from '../src/collection';

const liveCollectionSchema: CollectionSchema = {
  actions: [{ name: '__action__', scope: 'single' }],
  fields: {},
  searchable: true,
  segments: [],
};

const instanciateCollection = () => {
  const sequelize = new Sequelize('sqlite::memory:', { logging: false });

  return {
    liveCollection:
      // eslint-disable-next-line implicit-arrow-linebreak
      new LiveCollection('__name__', null, liveCollectionSchema, sequelize),
    sequelize,
  };
};

const preloadRecords = async (recordCount, options?) => {
  const { liveCollection, sequelize } = instanciateCollection();
  const recordData = new Array(recordCount).fill(0).map((_, i) => ({ value: `record_${i + 1}` }));

  if (options?.shuffle && recordCount > 1) {
    [recordData[0].value, recordData[recordCount - 1].value] = [
      recordData[recordCount - 1].value,
      recordData[0].value,
    ];
  }

  await liveCollection.sync();
  const sequelizeRecords = await sequelize
    .model(liveCollection.name)
    .bulkCreate(recordData, { returning: true });

  return {
    liveCollection,
    recordCount,
    recordData,
    sequelize,
    sequelizeRecords,
  };
};

describe('LiveDataSource > Collection', () => {
  it('should instanciate properly', () => {
    const { liveCollection } = instanciateCollection();

    expect(liveCollection).toBeDefined();
  });

  describe('sync', () => {
    it('should return a truthy Promise', async () => {
      const { liveCollection } = instanciateCollection();

      await expect(liveCollection.sync()).resolves.toBeTruthy();
    });

    it('should create the collection table', async () => {
      const { liveCollection, sequelize } = instanciateCollection();

      await liveCollection.sync();

      expect(sequelize.model(liveCollection.name)).toBeDefined();
      await expect(sequelize.model(liveCollection.name).findAll()).resolves.toBeArrayOfSize(0);
    });
  });

  describe('getAction', () => {
    it('should return a known action', () => {
      const { liveCollection } = instanciateCollection();

      // TODO: Match actual action when defined.
      expect(liveCollection.getAction('__action__')).toBeNull();
    });

    it('should thrown with an unknown action name', () => {
      const { liveCollection } = instanciateCollection();

      expect(() => liveCollection.getAction('__no_such_action__')).toThrow(
        'Action "__no_such_action__" not found.',
      );
    });
  });

  describe('getById', () => {
    it('should reject if collection is not synched first', async () => {
      const { liveCollection } = instanciateCollection();

      expect(() => liveCollection.getById([null], null)).toThrow(
        `Collection "${liveCollection.name}" is not synched yet. Call "sync" first.`,
      );
    });

    it('should resolve with the requested record data', async () => {
      const {
        liveCollection,
        sequelizeRecords: [expectedRecord],
      } = await preloadRecords(1);

      const record = await liveCollection.getById([Number(expectedRecord.get('id'))], null);

      expect(record).toEqual(
        expect.objectContaining({
          id: expectedRecord.get('id'),
          value: expectedRecord.get('value'),
        }),
      );
    });

    it.todo('should resolve when given an actual composite ID');

    it('should resolve honoring the projection', async () => {
      const {
        liveCollection,
        sequelizeRecords: [expectedRecord],
      } = await preloadRecords(1);

      const record = await liveCollection.getById([Number(expectedRecord.get('id'))], ['id']);

      expect(record.id).toEqual(expectedRecord.get('id'));
      expect(record.value).toBeUndefined();
    });
  });

  describe('create', () => {
    it('should reject if collection is not synched first', async () => {
      const { liveCollection } = instanciateCollection();

      expect(() => liveCollection.create([])).toThrow(
        `Collection "${liveCollection.name}" is not synched yet. Call "sync" first.`,
      );
    });

    it('should resolve with the newly created record data', async () => {
      const { liveCollection, recordCount, recordData } = await preloadRecords(9);

      const records = await liveCollection.create(recordData);

      expect(records).toBeArrayOfSize(recordCount);
      expect(records).toEqual(
        expect.arrayContaining(recordData.map(record => expect.objectContaining(record))),
      );
    });
  });

  describe('list', () => {
    it('should reject if collection is not synched first', async () => {
      const { liveCollection } = instanciateCollection();

      expect(() => liveCollection.list({}, [])).toThrow(
        `Collection "${liveCollection.name}" is not synched yet. Call "sync" first.`,
      );
    });

    it('should get all record data from the collection', async () => {
      const { liveCollection, recordCount } = await preloadRecords(9);

      await expect(liveCollection.list({}, null)).resolves.toBeArrayOfSize(recordCount);
    });

    it('should resolve honoring the projection', async () => {
      const { liveCollection, recordCount } = await preloadRecords(9);

      const records = await liveCollection.list({}, ['id']);

      records.forEach(record => {
        expect(record.id).toBeNumber();
        expect(record.value).toBeUndefined();
      });
    });

    describe('when using filtering', () => {
      // TODO: Test more cases.
      it('should resolve honoring the filtering', async () => {
        const { liveCollection } = await preloadRecords(9);

        const records = await liveCollection.list(
          { conditionTree: { operator: Operator.Equal, field: 'value', value: 'record_4' } },
          null,
        );

        expect(records).toBeArrayOfSize(1);
        expect(records[0].value).toEqual('record_4');
      });
    });

    describe('when using ordering', () => {
      it('should resolve honoring the ascending ordering', async () => {
        const { liveCollection } = await preloadRecords(9);

        const records = await liveCollection.list(
          { sort: [{ field: 'value', ascending: true }] },
          null,
        );
        const sortedRecords = sortBy(records, 'value');

        expect(records).toEqual(sortedRecords);
      });

      it('should resolve honoring the descending ordering', async () => {
        const { liveCollection } = await preloadRecords(9, { shuffle: true });

        const records = await liveCollection.list(
          { sort: [{ field: 'value', ascending: false }] },
          null,
        );
        const sortedRecords = sortBy(records, 'value').reverse();

        expect(records).toEqual(sortedRecords);
      });
    });

    describe('when using pagination', () => {
      it('should resolve honoring the `limit` parameter', async () => {
        const { liveCollection } = await preloadRecords(9);
        const limit = 2;

        const records = await liveCollection.list({ page: { skip: 0, limit } }, ['id']);

        expect(records).toBeArrayOfSize(limit);
      });

      it('should resolve honoring the `skip` parameter', async () => {
        const { liveCollection, recordCount } = await preloadRecords(9);
        const offset = 2;

        const records = await liveCollection.list(
          { sort: [{ field: 'value', ascending: true }], page: { skip: offset } },
          null,
        );

        expect(records).toBeArrayOfSize(recordCount - offset);
        records.forEach((record, i) => {
          expect(record.value).toEqual(`record_${i + 1 + offset}`);
        });
      });
    });
  });

  describe('update', () => {
    it.todo('TODO');
  });

  describe('delete', () => {
    it.todo('TODO');
  });

  describe('aggregate', () => {
    it.todo('TODO');
  });
});
