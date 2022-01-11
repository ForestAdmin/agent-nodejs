import { Sequelize } from 'sequelize';
import sortBy from 'lodash/sortBy';

import {
  AggregationOperation,
  CollectionSchema,
  FieldTypes,
  Operator,
  PrimitiveTypes,
} from '@forestadmin/datasource-toolkit';
import LiveCollection from '../src/collection';

const compositeKeyCollectionSchema: CollectionSchema = {
  actions: {},
  fields: {
    pkA: {
      columnType: PrimitiveTypes.Number,
      filterOperators: new Set<Operator>([Operator.Equal]),
      isPrimaryKey: true,
      type: FieldTypes.Column,
    },
    pkB: {
      columnType: PrimitiveTypes.Number,
      filterOperators: new Set<Operator>([Operator.Equal]),
      isPrimaryKey: true,
      type: FieldTypes.Column,
    },
    value: {
      columnType: PrimitiveTypes.String,
      filterOperators: new Set<Operator>(),
      type: FieldTypes.Column,
    },
  },
  searchable: false,
  segments: [],
};

const liveCollectionSchema: CollectionSchema = {
  actions: {},
  fields: {
    id: {
      columnType: PrimitiveTypes.Number,
      filterOperators: new Set<Operator>([Operator.Equal]),
      isPrimaryKey: true,
      type: FieldTypes.Column,
    },
    fixed: {
      columnType: PrimitiveTypes.String,
      filterOperators: new Set<Operator>(),
      type: FieldTypes.Column,
    },
    even: {
      columnType: PrimitiveTypes.Boolean,
      filterOperators: new Set<Operator>(),
      type: FieldTypes.Column,
    },
    value: {
      columnType: PrimitiveTypes.String,
      filterOperators: new Set<Operator>(),
      type: FieldTypes.Column,
    },
  },
  searchable: true,
  segments: [],
};

const instanciateCollection = schema => {
  const sequelize = new Sequelize('sqlite::memory:', { logging: false });

  return {
    liveCollection:
      // eslint-disable-next-line implicit-arrow-linebreak
      new LiveCollection('__name__', null, sequelize, schema),
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

  describe('getById', () => {
    it('should reject if collection is not synched first', async () => {
      const { liveCollection } = instanciateCollection(liveCollectionSchema);

      expect(() => liveCollection.getById([null], null)).toThrow(
        `Collection "${liveCollection.name}" is not synched yet. Call "sync" first.`,
      );
    });

    it('should resolve with the requested record data', async () => {
      const {
        liveCollection,
        sequelizeRecords: [expectedRecord],
      } = await preloadLiveCollectionRecords(1, liveCollectionSchema);

      const record = await liveCollection.getById([Number(expectedRecord.get('id'))], null);

      expect(record).toEqual(
        expect.objectContaining({
          id: expectedRecord.get('id'),
          value: expectedRecord.get('value'),
        }),
      );
    });

    it('should resolve when given an actual composite ID', async () => {
      const {
        liveCollection,
        sequelizeRecords: [expectedRecord],
      } = await preloadLiveCollectionRecords(1, liveCollectionSchema);

      const record = await liveCollection.getById([Number(expectedRecord.get('id'))], null);

      expect(record).toEqual(
        expect.objectContaining({
          id: expectedRecord.get('id'),
          value: expectedRecord.get('value'),
        }),
      );
    });

    it('should resolve honoring the projection', async () => {
      const {
        liveCollection,
        sequelizeRecords: [expectedRecord],
      } = await preloadLiveCollectionRecords(1, liveCollectionSchema);

      const record = await liveCollection.getById([Number(expectedRecord.get('id'))], ['id']);

      expect(record.id).toEqual(expectedRecord.get('id'));
      expect(record.value).toBeUndefined();
    });
  });

  describe('create', () => {
    it('should reject if collection is not synched first', async () => {
      const { liveCollection } = instanciateCollection(liveCollectionSchema);

      expect(() => liveCollection.create([])).toThrow(
        `Collection "${liveCollection.name}" is not synched yet. Call "sync" first.`,
      );
    });

    it('should resolve with the newly created record data', async () => {
      const { liveCollection, recordCount, recordData } = await preloadLiveCollectionRecords(
        9,
        liveCollectionSchema,
      );

      const records = await liveCollection.create(recordData);

      expect(records).toBeArrayOfSize(recordCount);
      expect(records).toEqual(
        expect.arrayContaining(recordData.map(record => expect.objectContaining(record))),
      );
    });
  });

  describe('list', () => {
    it('should reject if collection is not synched first', async () => {
      const { liveCollection } = instanciateCollection(liveCollectionSchema);

      expect(() => liveCollection.list({}, [])).toThrow(
        `Collection "${liveCollection.name}" is not synched yet. Call "sync" first.`,
      );
    });

    it('should get all record data from the collection', async () => {
      const { liveCollection, recordCount } = await preloadLiveCollectionRecords(
        9,
        liveCollectionSchema,
      );

      await expect(liveCollection.list({}, null)).resolves.toBeArrayOfSize(recordCount);
    });

    it('should resolve honoring the projection', async () => {
      const { liveCollection } = await preloadLiveCollectionRecords(9, liveCollectionSchema);

      const records = await liveCollection.list({}, ['id']);

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
          { conditionTree: { operator: Operator.Equal, field: 'value', value: 'record_4' } },
          null,
        );

        expect(records).toBeArrayOfSize(1);
        expect(records[0].value).toEqual('record_4');
      });
    });

    describe('when using ordering', () => {
      it('should resolve honoring the ascending ordering', async () => {
        const { liveCollection } = await preloadLiveCollectionRecords(9, liveCollectionSchema);

        const records = await liveCollection.list(
          { sort: [{ field: 'value', ascending: true }] },
          null,
        );
        const sortedRecords = sortBy(records, 'value');

        expect(records).toEqual(sortedRecords);
      });

      it('should resolve honoring the descending ordering', async () => {
        const { liveCollection } = await preloadLiveCollectionRecords(9, liveCollectionSchema, {
          shuffle: true,
        });

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
        const { liveCollection } = await preloadLiveCollectionRecords(9, liveCollectionSchema);
        const limit = 2;

        const records = await liveCollection.list({ page: { skip: 0, limit } }, ['id']);

        expect(records).toBeArrayOfSize(limit);
      });

      it('should resolve honoring the `skip` parameter', async () => {
        const { liveCollection, recordCount } = await preloadLiveCollectionRecords(
          9,
          liveCollectionSchema,
        );
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
    it('should reject if collection is not synched first', async () => {
      const { liveCollection } = instanciateCollection(liveCollectionSchema);

      expect(() => liveCollection.update({}, {})).toThrow(
        `Collection "${liveCollection.name}" is not synched yet. Call "sync" first.`,
      );
    });

    it('should resolve with `null`', async () => {
      const { liveCollection } = await preloadLiveCollectionRecords(9, liveCollectionSchema);
      const filter = {
        conditionTree: { operator: Operator.Equal, field: 'id', value: '__unknown__' },
      };
      const patch = { value: '__new__value__' };

      await expect(liveCollection.update(filter, patch)).resolves.toBeNull();
    });

    it('should update records honoring filter and patch', async () => {
      const { liveCollection, fixedValue, recordData, sequelize } =
        await preloadLiveCollectionRecords(9, liveCollectionSchema);

      const [originalRecord] = await plainRecords(
        sequelize.model(liveCollection.name).findAll({ where: { value: recordData[4].value } }),
      );

      const filter = {
        conditionTree: {
          operator: Operator.Equal,
          field: 'id',
          value: originalRecord.id,
        },
      };
      const patch = { value: '__new__value__' };

      await liveCollection.update(filter, patch);

      const allRecords = await plainRecords(sequelize.model(liveCollection.name).findAll());

      allRecords.forEach(record => {
        expect(record.fixed).toEqual(fixedValue);
        if (record.id === originalRecord.id) expect(record.value).toEqual('__new__value__');
        else expect(record.value).toMatch(/^record_[0-9]$/);
      });
    });
  });

  describe('delete', () => {
    it('should reject if collection is not synched first', async () => {
      const { liveCollection } = instanciateCollection(liveCollectionSchema);

      expect(() => liveCollection.delete({})).toThrow(
        `Collection "${liveCollection.name}" is not synched yet. Call "sync" first.`,
      );
    });

    it('should resolve with `null`', async () => {
      const { liveCollection } = await preloadLiveCollectionRecords(9, liveCollectionSchema);
      const filter = {
        conditionTree: { operator: Operator.Equal, field: 'id', value: '__unknown__' },
      };

      await expect(liveCollection.delete(filter)).resolves.toBeNull();
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

      const filter = {
        conditionTree: {
          operator: Operator.Equal,
          field: 'id',
          value: originalRecord.id,
        },
      };

      await liveCollection.delete(filter);

      const newRecordCount = await sequelize.model(liveCollection.name).count();

      expect(newRecordCount).toEqual(recordCount - 1);
    });
  });

  describe('aggregate', () => {
    it('should reject if collection is not synched first', async () => {
      const { liveCollection } = instanciateCollection(liveCollectionSchema);
      const aggregation = {
        operation: AggregationOperation.Count,
      };

      expect(() => liveCollection.aggregate({}, aggregation)).toThrow(
        `Collection "${liveCollection.name}" is not synched yet. Call "sync" first.`,
      );
    });

    it('should resolve with an aggregation array', async () => {
      const recordCount = 9;
      const { liveCollection } = await preloadLiveCollectionRecords(
        recordCount,
        liveCollectionSchema,
      );
      const aggregation = {
        operation: AggregationOperation.Count,
      };

      await expect(liveCollection.aggregate({}, aggregation)).resolves.toEqual([
        { group: '*', value: recordCount },
      ]);
    });

    it('should resolve honoring filter', async () => {
      const recordCount = 9;
      const { liveCollection, recordData, sequelize } = await preloadLiveCollectionRecords(
        recordCount,
        liveCollectionSchema,
      );
      const aggregation = {
        operation: AggregationOperation.Count,
      };

      const [originalRecord] = await plainRecords(
        sequelize.model(liveCollection.name).findAll({ where: { value: recordData[4].value } }),
      );

      const filter = {
        conditionTree: {
          operator: Operator.Equal,
          field: 'id',
          value: originalRecord.id,
        },
      };

      await expect(liveCollection.aggregate(filter, aggregation)).resolves.toEqual([
        { group: '*', value: 1 },
      ]);
    });

    it('should resolve honoring field', async () => {
      const recordCount = 9;
      const { liveCollection } = await preloadLiveCollectionRecords(
        recordCount,
        liveCollectionSchema,
      );
      const aggregation = {
        field: 'even',
        operation: AggregationOperation.Count,
      };

      await expect(liveCollection.aggregate({}, aggregation)).resolves.toEqual(
        expect.arrayContaining([
          { group: 'true', value: 5 },
          { group: 'false', value: 4 },
        ]),
      );
    });
  });
});
