import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import {
  Aggregation,
  ConditionTreeLeaf,
  DataSource,
  Filter,
  Page,
  PaginatedFilter,
  Projection,
  Sort,
} from '@forestadmin/datasource-toolkit';
import { Op, Sequelize } from 'sequelize';
import sortBy from 'lodash/sortBy';

import { LiveCollectionSchema } from '../src/types';
import CollectionAttributesConverter from '../src/utils/collection-schema-to-model-attributes-converter';
import LiveCollection from '../src/collection';

const liveCollectionSchema: LiveCollectionSchema = {
  id: {
    columnType: 'Number',
    isPrimaryKey: true,
    type: 'Column',
  },
  fixed: {
    columnType: 'String',
    type: 'Column',
  },
  even: {
    columnType: 'Boolean',
    type: 'Column',
  },
  value: {
    columnType: 'String',
    type: 'Column',
  },
};

const instanciateCollection = schema => {
  const dataSource = Symbol('datasource') as unknown as DataSource;
  const sequelize = new Sequelize('sqlite::memory:', { logging: false });
  const model = sequelize.define('__name__', CollectionAttributesConverter.convert(schema));

  return {
    liveCollection: new LiveCollection('__name__', dataSource, model),
    model,
    sequelize,
  };
};

const preloadRecords = async (recordCount, schema, options) => {
  const { liveCollection, sequelize } = instanciateCollection(schema);
  const recordData = new Array(recordCount).fill(0).map((_, i) => options.recordBuilder(i));

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

const preloadLiveCollectionRecords = async (recordCount, schema, options = {}) => {
  const fixedValue = '__fixed__';

  // eslint-disable-next-line @typescript-eslint/dot-notation
  options['recordBuilder'] = index => ({
    fixed: fixedValue,
    even: index % 2 === 0,
    value: `record_${index + 1}`,
  });

  return {
    ...(await preloadRecords(recordCount, schema, options)),
    fixedValue,
  };
};

const plainRecords = async promise => {
  const records = await promise;

  return records.map(record => record.get());
};

describe('LiveDataSource > Collection', () => {
  it('should instanciate properly', () => {
    const { liveCollection } = instanciateCollection(liveCollectionSchema);

    expect(liveCollection).toBeDefined();
  });

  describe('sync', () => {
    it('should return a truthy Promise', async () => {
      const { liveCollection } = instanciateCollection(liveCollectionSchema);

      await expect(liveCollection.sync()).resolves.toBeTruthy();
    });

    it('should create the collection table', async () => {
      const { liveCollection, sequelize } = instanciateCollection(liveCollectionSchema);

      await liveCollection.sync();

      expect(sequelize.model(liveCollection.name)).toBeDefined();
      await expect(sequelize.model(liveCollection.name).findAll()).resolves.toBeArrayOfSize(0);
    });
  });

  describe('create', () => {
    it('should reject if collection is not synched first', async () => {
      const { liveCollection } = instanciateCollection(liveCollectionSchema);

      expect(() => liveCollection.create(factories.caller.build(), [])).toThrow(
        `Collection "${liveCollection.name}" is not synched yet. Call "sync" first.`,
      );
    });

    it('should resolve with the newly created record data', async () => {
      const { liveCollection, recordCount, recordData } = await preloadLiveCollectionRecords(
        9,
        liveCollectionSchema,
      );

      const records = await liveCollection.create(factories.caller.build(), recordData);

      expect(records).toBeArrayOfSize(recordCount);
      expect(records).toEqual(
        expect.arrayContaining(recordData.map(record => expect.objectContaining(record))),
      );
    });
  });

  describe('list', () => {
    it('should reject if collection is not synched first', async () => {
      const { liveCollection } = instanciateCollection(liveCollectionSchema);

      expect(() => liveCollection.list(factories.caller.build(), null, null)).toThrow(
        `Collection "${liveCollection.name}" is not synched yet. Call "sync" first.`,
      );
    });

    it('should get all record data from the collection', async () => {
      const { liveCollection, recordCount } = await preloadLiveCollectionRecords(
        9,
        liveCollectionSchema,
      );

      await expect(
        liveCollection.list(
          factories.caller.build(),
          new PaginatedFilter({}),
          new Projection('id'),
        ),
      ).resolves.toBeArrayOfSize(recordCount);
    });

    it('should resolve honoring the projection', async () => {
      const { liveCollection } = await preloadLiveCollectionRecords(9, liveCollectionSchema);

      const records = await liveCollection.list(
        factories.caller.build(),
        new PaginatedFilter({}),
        new Projection('id'),
      );

      records.forEach(record => {
        expect(record.id).toBeNumber();
        expect(record.value).toBeUndefined();
      });
    });

    describe('when using filtering', () => {
      // TODO: Test more cases.
      it('should resolve honoring the filtering', async () => {
        const { liveCollection } = await preloadLiveCollectionRecords(9, liveCollectionSchema);

        const records = await liveCollection.list(
          factories.caller.build(),
          new PaginatedFilter({
            conditionTree: new ConditionTreeLeaf('value', 'Equal', 'record_4'),
          }),
          new Projection('value'),
        );

        expect(records).toBeArrayOfSize(1);
        expect(records[0].value).toEqual('record_4');
      });
    });

    describe('when using ordering', () => {
      it('should resolve honoring the ascending ordering', async () => {
        const { liveCollection } = await preloadLiveCollectionRecords(9, liveCollectionSchema);

        const records = await liveCollection.list(
          factories.caller.build(),
          new PaginatedFilter({ sort: new Sort({ field: 'value', ascending: true }) }),
          new Projection('value'),
        );
        const sortedRecords = sortBy(records, 'value');

        expect(records).toEqual(sortedRecords);
      });

      it('should resolve honoring the descending ordering', async () => {
        const { liveCollection } = await preloadLiveCollectionRecords(9, liveCollectionSchema, {
          shuffle: true,
        });

        const records = await liveCollection.list(
          factories.caller.build(),
          new PaginatedFilter({ sort: new Sort({ field: 'value', ascending: false }) }),
          new Projection('value'),
        );
        const sortedRecords = sortBy(records, 'value').reverse();

        expect(records).toEqual(sortedRecords);
      });
    });

    describe('when using pagination', () => {
      it('should resolve honoring the `limit` parameter', async () => {
        const { liveCollection } = await preloadLiveCollectionRecords(9, liveCollectionSchema);
        const limit = 2;

        const records = await liveCollection.list(
          factories.caller.build(),
          new PaginatedFilter({ page: new Page(null, limit) }),
          new Projection('id'),
        );

        expect(records).toBeArrayOfSize(limit);
      });

      it('should resolve honoring the `skip` parameter', async () => {
        const { liveCollection, recordCount } = await preloadLiveCollectionRecords(
          9,
          liveCollectionSchema,
        );
        const offset = 2;

        const records = await liveCollection.list(
          factories.caller.build(),
          new PaginatedFilter({
            sort: new Sort({ field: 'value', ascending: true }),
            page: new Page(offset),
          }),
          new Projection('value'),
        );

        expect(records).toBeArrayOfSize(recordCount - offset);
        records.forEach((record, i) => {
          expect(record.value).toEqual(`record_${i + 1 + offset}`);
        });
      });
    });
  });

  describe('update', () => {
    it('should reject if collection is not synched first', async () => {
      const { liveCollection } = instanciateCollection(liveCollectionSchema);

      expect(() => liveCollection.update(factories.caller.build(), null, {})).toThrow(
        `Collection "${liveCollection.name}" is not synched yet. Call "sync" first.`,
      );
    });

    it('should resolve', async () => {
      const { liveCollection } = await preloadLiveCollectionRecords(9, liveCollectionSchema);
      const filter = new Filter({
        conditionTree: new ConditionTreeLeaf('id', 'Equal', '__unknown__'),
      });
      const patch = { value: '__new__value__' };

      await expect(
        liveCollection.update(factories.caller.build(), filter, patch),
      ).resolves.not.toThrow();
    });

    it('should update records honoring filter and patch', async () => {
      const { liveCollection, fixedValue, recordData, sequelize } =
        await preloadLiveCollectionRecords(9, liveCollectionSchema);

      const [originalRecord] = await plainRecords(
        sequelize.model(liveCollection.name).findAll({ where: { value: recordData[4].value } }),
      );

      const filter = new Filter({
        conditionTree: new ConditionTreeLeaf('id', 'Equal', originalRecord.id),
      });
      const patch = { value: '__new__value__' };

      await liveCollection.update(factories.caller.build(), filter, patch);

      const allRecords = await plainRecords(
        sequelize
          .model(liveCollection.name)
          .findAll({ where: { id: { [Op.not]: originalRecord.id } } }),
      );

      allRecords.forEach(record => {
        expect(record.fixed).toEqual(fixedValue);
        expect(record.value).toMatch(/^record_[0-9]$/);
      });

      const [updatedRecord] = await plainRecords(
        sequelize.model(liveCollection.name).findAll({ where: { id: originalRecord.id } }),
      );
      expect(updatedRecord.fixed).toEqual(fixedValue);
      expect(updatedRecord.value).toEqual('__new__value__');
    });
  });

  describe('delete', () => {
    it('should reject if collection is not synched first', async () => {
      const { liveCollection } = instanciateCollection(liveCollectionSchema);

      expect(() => liveCollection.delete(factories.caller.build(), null)).toThrow(
        `Collection "${liveCollection.name}" is not synched yet. Call "sync" first.`,
      );
    });

    it('should resolve', async () => {
      const { liveCollection } = await preloadLiveCollectionRecords(9, liveCollectionSchema);
      const filter = new Filter({
        conditionTree: new ConditionTreeLeaf('id', 'Equal', '__unknown__'),
      });

      await expect(liveCollection.delete(factories.caller.build(), filter)).resolves.not.toThrow();
    });

    it('should delete records honoring filter', async () => {
      const recordCount = 9;
      const { liveCollection, recordData, sequelize } = await preloadLiveCollectionRecords(
        recordCount,
        liveCollectionSchema,
      );

      const [originalRecord] = await plainRecords(
        sequelize.model(liveCollection.name).findAll({ where: { value: recordData[4].value } }),
      );

      const filter = new Filter({
        conditionTree: new ConditionTreeLeaf('id', 'Equal', originalRecord.id),
      });

      await liveCollection.delete(factories.caller.build(), filter);

      const newRecordCount = await sequelize.model(liveCollection.name).count();

      expect(newRecordCount).toEqual(recordCount - 1);
    });
  });

  describe('aggregate', () => {
    it('should reject if collection is not synched first', async () => {
      const { liveCollection } = instanciateCollection(liveCollectionSchema);

      expect(() => liveCollection.aggregate(factories.caller.build(), null, null)).toThrow(
        `Collection "${liveCollection.name}" is not synched yet. Call "sync" first.`,
      );
    });

    it('should resolve with an aggregation array', async () => {
      const recordCount = 9;
      const { liveCollection } = await preloadLiveCollectionRecords(
        recordCount,
        liveCollectionSchema,
      );
      const aggregation = new Aggregation({
        operation: 'Count',
      });

      await expect(
        liveCollection.aggregate(factories.caller.build(), new PaginatedFilter({}), aggregation),
      ).resolves.toEqual([{ group: {}, value: recordCount }]);
    });

    it('should resolve honoring filter', async () => {
      const recordCount = 9;
      const { liveCollection, recordData, sequelize } = await preloadLiveCollectionRecords(
        recordCount,
        liveCollectionSchema,
      );
      const aggregation = new Aggregation({
        operation: 'Count',
      });

      const [originalRecord] = await plainRecords(
        sequelize.model(liveCollection.name).findAll({ where: { value: recordData[4].value } }),
      );

      const filter = new Filter({
        conditionTree: new ConditionTreeLeaf('id', 'Equal', originalRecord.id),
      });

      await expect(
        liveCollection.aggregate(factories.caller.build(), filter, aggregation),
      ).resolves.toEqual([{ group: {}, value: 1 }]);
    });

    it('should resolve honoring field', async () => {
      const recordCount = 9;
      const { liveCollection } = await preloadLiveCollectionRecords(
        recordCount,
        liveCollectionSchema,
      );
      const aggregation = new Aggregation({
        field: 'even',
        operation: 'Sum',
      });

      await expect(
        liveCollection.aggregate(factories.caller.build(), new PaginatedFilter({}), aggregation),
      ).resolves.toEqual(expect.arrayContaining([{ group: {}, value: 5 }]));
    });

    it('should resolve honoring groups', async () => {
      const recordCount = 9;
      const { liveCollection } = await preloadLiveCollectionRecords(
        recordCount,
        liveCollectionSchema,
      );
      const aggregation = new Aggregation({
        field: 'even',
        operation: 'Count',
        groups: [{ field: 'even' }],
      });

      await expect(
        liveCollection.aggregate(factories.caller.build(), new PaginatedFilter({}), aggregation),
      ).resolves.toEqual(
        expect.arrayContaining([
          { group: { even: 1 }, value: 5 },
          { group: { even: 0 }, value: 4 },
        ]),
      );
    });
  });
});
