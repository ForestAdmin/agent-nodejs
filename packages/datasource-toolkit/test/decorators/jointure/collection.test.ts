import * as factories from '../../__factories__';
import { Collection, DataSource } from '../../../src/interfaces/collection';

import {
  ColumnSchema,
  FieldTypes,
  ManyToManySchema,
  PrimitiveTypes,
} from '../../../src/interfaces/schema';
import { PaginatedFilter, Sort } from '../../../src';
import Aggregation, { AggregationOperation } from '../../../src/interfaces/query/aggregation';
import ConditionTreeLeaf, {
  Operator,
} from '../../../src/interfaces/query/condition-tree/nodes/leaf';
import DataSourceDecorator from '../../../src/decorators/datasource-decorator';
import Filter from '../../../src/interfaces/query/filter/unpaginated';
import JointureCollectionDecorator from '../../../src/decorators/jointure/collection';
import Projection from '../../../src/interfaces/query/projection';

describe('JointureCollectionDecorator', () => {
  // State
  let dataSource: DataSource;
  let decoratedDataSource: DataSourceDecorator<JointureCollectionDecorator>;

  let pictures: Collection;
  let passports: Collection;
  let persons: Collection;
  let newPassports: JointureCollectionDecorator;
  let newPersons: JointureCollectionDecorator;

  beforeEach(() => {
    // Build passports
    const passportRecords = [
      {
        id: 101,
        issueDate: '2010-01-01',
        ownerId: 202,
        pictureId: 301,
        picture: { id: 301, filename: 'pic1.jpg' },
      },
      {
        id: 102,
        issueDate: '2017-01-01',
        ownerId: 201,
        pictureId: 302,
        picture: { id: 302, filename: 'pic2.jpg' },
      },
      {
        id: 103,
        issueDate: '2017-02-05',
        ownerId: null,
        pictureId: 303,
        picture: { id: 303, filename: 'pic3.jpg' },
      },
    ];

    // Build persons
    const personsRecords = [
      { id: 201, name: 'Sharon J. Whalen' },
      { id: 202, name: 'Mae S. Waldron' },
      { id: 203, name: 'Joseph P. Rodriguez' },
    ];

    dataSource = factories.dataSource.buildWithCollections([
      // Build pictures
      // Note that pictures is a native relationship that exists in the underlying
      // datasource.
      factories.collection.build({
        name: 'pictures',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.build({
              isPrimaryKey: true,
              columnType: PrimitiveTypes.Number,
            }),
            filename: factories.columnSchema.build(),
          },
        }),
        list: jest.fn().mockRejectedValue(new Error('should never be called')),
        aggregate: jest.fn().mockRejectedValue(new Error('should never be called')),
      }),

      factories.collection.build({
        name: 'passports',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.build({
              isPrimaryKey: true,
              columnType: PrimitiveTypes.Number,
            }),
            issueDate: factories.columnSchema.build({ columnType: PrimitiveTypes.Dateonly }),
            ownerId: factories.columnSchema.build({ columnType: PrimitiveTypes.Number }),
            pictureId: factories.columnSchema.build({ columnType: PrimitiveTypes.Number }),
            picture: factories.manyToOneSchema.build({
              foreignCollection: 'pictures',
              foreignKey: 'pictureId',
            }),
          },
        }),
        list: jest.fn().mockImplementation((filter, projection) => {
          let result = passportRecords.slice();
          if (filter?.conditionTree)
            result = filter.conditionTree.apply(result, passports, 'Europe/Paris');
          if (filter?.sort) result = filter.sort.apply(result);

          return projection.apply(result);
        }),
        aggregate: jest.fn().mockImplementation((_, aggregate: Aggregation) => {
          return aggregate.apply(passportRecords, 'Europe/Paris');
        }),
      }),

      factories.collection.build({
        name: 'persons',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.build({
              isPrimaryKey: true,
              columnType: PrimitiveTypes.Number,
            }),
            name: factories.columnSchema.build(),
          },
        }),
        list: jest.fn().mockImplementation((filter, projection) => {
          let result = personsRecords.slice();
          if (filter?.conditionTree)
            result = filter.conditionTree.apply(result, persons, 'Europe/Paris');
          if (filter?.sort) result = filter.sort.apply(result);

          return projection.apply(result);
        }),
        aggregate: jest.fn().mockImplementation((_, aggregate: Aggregation) => {
          return aggregate.apply(personsRecords, 'Europe/Paris');
        }),
      }),
    ]);

    pictures = dataSource.getCollection('pictures');
    passports = dataSource.getCollection('passports');
    persons = dataSource.getCollection('persons');
  });

  // Build decorator
  beforeEach(() => {
    decoratedDataSource = new DataSourceDecorator(dataSource, JointureCollectionDecorator);

    newPassports = decoratedDataSource.getCollection('passports');
    newPersons = decoratedDataSource.getCollection('persons');
  });

  describe('builder valid cases', () => {
    test('should not throw with a one to one', () => {
      expect(() =>
        newPersons.addJointure('passport', {
          type: FieldTypes.OneToOne,
          foreignCollection: 'passports',
          foreignKey: 'ownerId',
        }),
      ).not.toThrow();
    });

    test('should not throw with a one to many', () => {
      expect(() =>
        newPersons.addJointure('passport', {
          type: FieldTypes.OneToMany,
          foreignCollection: 'passports',
          foreignKey: 'ownerId',
        }),
      ).not.toThrow();
    });

    test('should not throw with a many to one', () => {
      expect(() =>
        newPassports.addJointure('owner', {
          type: FieldTypes.ManyToOne,
          foreignCollection: 'persons',
          foreignKey: 'ownerId',
        }),
      ).not.toThrow();
    });

    test('should not throw with a very convoluted many to many', () => {
      expect(() =>
        newPersons.addJointure('persons', {
          type: FieldTypes.ManyToMany,
          foreignCollection: 'passports',
          foreignKey: 'ownerId',
          otherField: 'ownerId',
          throughCollection: 'passports',
        } as ManyToManySchema),
      ).not.toThrow();
    });
  });

  describe('builder error cases', () => {
    describe('missing dependencies', () => {
      test('should throw with a non existent collection', () => {
        expect(() =>
          newPassports.addJointure('someName', {
            type: FieldTypes.ManyToOne,
            foreignCollection: '__nonExisting__',
            foreignKey: 'ownerId',
          }),
        ).toThrow('Collection "__nonExisting__" not found.');
      });

      test('should throw with a non existent fk (many to one)', () => {
        expect(() =>
          newPassports.addJointure('owner', {
            type: FieldTypes.ManyToOne,
            foreignCollection: 'persons',
            foreignKey: '__nonExisting__',
          }),
        ).toThrow("Column not found: 'passports.__nonExisting__'");
      });

      test('should throw with a non existent fk (one to one)', () => {
        expect(() =>
          newPersons.addJointure('persons', {
            type: FieldTypes.OneToOne,
            foreignCollection: 'passports',
            foreignKey: '__nonExisting__',
          }),
        ).toThrow("Column not found: 'passports.__nonExisting__'");
      });

      test('should throw with a non existent though collection (many to many)', () => {
        expect(() =>
          newPersons.addJointure('persons', {
            type: FieldTypes.ManyToMany,
            foreignCollection: 'passports',
            foreignKey: 'ownerId',
            otherField: 'ownerId',
            throughCollection: '__nonExisting__',
          } as ManyToManySchema),
        ).toThrow('Collection "__nonExisting__" not found.');
      });

      test('should throw with a non existent fk (many to many)', () => {
        expect(() =>
          newPersons.addJointure('persons', {
            type: FieldTypes.ManyToMany,
            foreignCollection: 'passports',
            foreignKey: 'ownerId',
            otherField: '__nonExisting__',
            throughCollection: 'passports',
          } as ManyToManySchema),
        ).toThrow("Column not found: 'passports.__nonExisting__'");
      });

      test('should throw with a non existent otherkey (many to many)', () => {
        expect(() =>
          newPersons.addJointure('persons', {
            type: FieldTypes.ManyToMany,
            foreignCollection: 'passports',
            foreignKey: '__nonExisting__',
            otherField: 'ownerId',
            throughCollection: 'passports',
          } as ManyToManySchema),
        ).toThrow("Column not found: 'passports.__nonExisting__'");
      });
    });

    describe('type mismatch', () => {
      test('should throw when fk type does not match pk (one to one)', () => {
        expect(() =>
          newPersons.addJointure('passport', {
            type: FieldTypes.OneToOne,
            foreignCollection: 'passports',
            foreignKey: 'issueDate',
          }),
        ).toThrow('Types from source foreignKey and target primary key do not match.');
      });

      test('should throw when otherfield type does not match pk (many to many)', () => {
        expect(() =>
          newPersons.addJointure('persons', {
            type: FieldTypes.ManyToMany,
            foreignCollection: 'passports',
            foreignKey: 'id',
            otherField: 'filename',
            throughCollection: 'pictures',
          } as ManyToManySchema),
        ).toThrow('Types from source otherField and target primary key do not match.');
      });
    });

    describe('missing operators', () => {
      test('should throw when In is not supported by the pk in the target (many to one)', () => {
        const schema = persons.schema.fields.id as ColumnSchema;
        schema.filterOperators.clear();

        expect(() =>
          newPassports.addJointure('owner', {
            type: FieldTypes.ManyToOne,
            foreignCollection: 'persons',
            foreignKey: 'ownerId',
          }),
        ).toThrow(
          'Jointure emulation requires target collection primary and foreign key to ' +
            'support the In operator',
        );
      });

      test('should throw when In is not supported by the fk in the target (one to one)', () => {
        const schema = passports.schema.fields.ownerId as ColumnSchema;
        schema.filterOperators.clear();

        expect(() =>
          newPersons.addJointure('passport', {
            type: FieldTypes.OneToOne,
            foreignCollection: 'passports',
            foreignKey: 'ownerId',
          }),
        ).toThrow(
          'Jointure emulation requires target collection primary and foreign key to ' +
            'support the In operator',
        );
      });
    });
  });

  describe('with two emulated relations', () => {
    beforeEach(() => {
      newPersons.addJointure('passport', {
        type: FieldTypes.OneToOne,
        foreignCollection: 'passports',
        foreignKey: 'ownerId',
      });

      newPassports.addJointure('owner', {
        type: FieldTypes.ManyToOne,
        foreignCollection: 'persons',
        foreignKey: 'ownerId',
      });
    });

    describe('emulated filtering', () => {
      test('should filter by a many to one relation', async () => {
        const records = await newPassports.list(
          new Filter({
            conditionTree: new ConditionTreeLeaf('owner:name', Operator.Equal, 'Mae S. Waldron'),
            timezone: 'Europe/Paris',
          }),
          new Projection('id', 'issueDate'),
        );

        expect(records).toStrictEqual([{ id: 101, issueDate: '2010-01-01' }]);
      });

      test('should filter by a one to one relation', async () => {
        const records = await newPersons.list(
          new Filter({
            conditionTree: new ConditionTreeLeaf(
              'passport:issueDate',
              Operator.Equal,
              '2017-01-01',
            ),
            timezone: 'Europe/Paris',
          }),
          new Projection('id', 'name'),
        );

        expect(records).toStrictEqual([{ id: 201, name: 'Sharon J. Whalen' }]);
      });

      test('should filter by native relation behind an emulated one', async () => {
        const records = await newPersons.list(
          new Filter({
            conditionTree: new ConditionTreeLeaf(
              'passport:picture:filename',
              Operator.Equal,
              'pic1.jpg',
            ),
            timezone: 'Europe/Paris',
          }),
          new Projection('id', 'name'),
        );

        expect(records).toStrictEqual([{ id: 202, name: 'Mae S. Waldron' }]);

        // make sure that the emulator did not trigger on native relation
        expect(pictures.list).not.toHaveBeenCalled();
      });

      test('should not break with deep filters', async () => {
        const records = await newPersons.list(
          new Filter({
            conditionTree: new ConditionTreeLeaf(
              'passport:owner:passport:issueDate',
              Operator.Equal,
              '2017-01-01',
            ),
            timezone: 'Europe/Paris',
          }),
          new Projection('id', 'name'),
        );

        expect(records).toStrictEqual([{ id: 201, name: 'Sharon J. Whalen' }]);
      });
    });

    describe('emulated projection', () => {
      test('should fetch fields from a many to one relation', async () => {
        const records = await newPassports.list(new Filter({}), new Projection('id', 'owner:name'));

        expect(records).toStrictEqual([
          { id: 101, owner: { name: 'Mae S. Waldron' } },
          { id: 102, owner: { name: 'Sharon J. Whalen' } },
          { id: 103, owner: null },
        ]);
      });

      test('should fetch fields from a one to one relation', async () => {
        const records = await newPersons.list(
          new Filter({}),
          new Projection('id', 'name', 'passport:issueDate'),
        );

        expect(records).toStrictEqual([
          { id: 201, name: 'Sharon J. Whalen', passport: { issueDate: '2017-01-01' } },
          { id: 202, name: 'Mae S. Waldron', passport: { issueDate: '2010-01-01' } },
          { id: 203, name: 'Joseph P. Rodriguez', passport: null },
        ]);
      });

      test('should fetch fields from a native behind an emulated one', async () => {
        const records = await newPersons.list(
          new Filter({}),
          new Projection('id', 'name', 'passport:picture:filename'),
        );

        expect(records).toStrictEqual([
          { id: 201, name: 'Sharon J. Whalen', passport: { picture: { filename: 'pic2.jpg' } } },
          { id: 202, name: 'Mae S. Waldron', passport: { picture: { filename: 'pic1.jpg' } } },
          { id: 203, name: 'Joseph P. Rodriguez', passport: null },
        ]);

        // make sure that the emulator did not trigger on native relation
        expect(pictures.list).not.toHaveBeenCalled();
      });

      test('should not break with deep reprojection', async () => {
        const records = await newPersons.list(
          new Filter({}),
          new Projection('id', 'name', 'passport:owner:passport:issueDate'),
        );

        expect(records).toStrictEqual([
          {
            id: 201,
            name: 'Sharon J. Whalen',
            passport: { owner: { passport: { issueDate: '2017-01-01' } } },
          },
          {
            id: 202,
            name: 'Mae S. Waldron',
            passport: { owner: { passport: { issueDate: '2010-01-01' } } },
          },
          { id: 203, name: 'Joseph P. Rodriguez', passport: null },
        ]);
      });
    });

    describe('emulated sorting', () => {
      test('should replace sorts in emulated many to one into sort by fk', async () => {
        // check both sides to make sure we're not getting lucky
        const ascending = await newPassports.list(
          new PaginatedFilter({ sort: new Sort({ field: 'owner:name', ascending: true }) }),
          new Projection('id', 'ownerId', 'owner:name'),
        );

        const descending = await newPassports.list(
          new PaginatedFilter({ sort: new Sort({ field: 'owner:name', ascending: false }) }),
          new Projection('id', 'ownerId', 'owner:name'),
        );

        expect(ascending).toStrictEqual([
          { id: 103, ownerId: null, owner: null },
          { id: 102, ownerId: 201, owner: { name: 'Sharon J. Whalen' } },
          { id: 101, ownerId: 202, owner: { name: 'Mae S. Waldron' } },
        ]);

        expect(descending).toStrictEqual([
          { id: 101, ownerId: 202, owner: { name: 'Mae S. Waldron' } },
          { id: 102, ownerId: 201, owner: { name: 'Sharon J. Whalen' } },
          { id: 103, ownerId: null, owner: null },
        ]);
      });
    });

    describe('emulated aggregation', () => {
      test("should not emulate aggregation which don't need it", async () => {
        const filter = new Filter({});
        const aggregation = new Aggregation({
          operation: AggregationOperation.Count,
          groups: [{ field: 'name' }],
        });
        const groups = await newPersons.aggregate(filter, aggregation, null);

        expect(persons.aggregate).toHaveBeenCalledWith(filter, aggregation, null);
        expect(groups).toStrictEqual([
          { value: 1, group: { name: 'Sharon J. Whalen' } },
          { value: 1, group: { name: 'Mae S. Waldron' } },
          { value: 1, group: { name: 'Joseph P. Rodriguez' } },
        ]);
      });

      test('should give valid results otherwise', async () => {
        const filter = new Filter({});
        const aggregation = new Aggregation({
          operation: AggregationOperation.Count,
          groups: [{ field: 'passport:picture:filename' }],
        });
        const groups = await newPersons.aggregate(filter, aggregation, 2);

        expect(groups).toStrictEqual([
          { value: 1, group: { 'passport:picture:filename': 'pic2.jpg' } },
          { value: 1, group: { 'passport:picture:filename': 'pic1.jpg' } },
        ]);
      });
    });
  });
});
