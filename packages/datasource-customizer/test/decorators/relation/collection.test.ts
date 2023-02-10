import {
  Aggregation,
  Collection,
  ColumnSchema,
  ConditionTreeLeaf,
  DataSource,
  Filter,
  ManyToManySchema,
  Filter,
  Projection,
  Sort,
} from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import DataSourceDecorator from '../../../src/decorators/datasource-decorator';
import RelationCollectionDecorator from '../../../src/decorators/relation/collection';

describe('RelationCollectionDecorator', () => {
  // State
  let dataSource: DataSource;
  let decoratedDataSource: DataSourceDecorator<RelationCollectionDecorator>;

  let pictures: Collection;
  let passports: Collection;
  let persons: Collection;
  let newPassports: RelationCollectionDecorator;
  let newPersons: RelationCollectionDecorator;

  beforeEach(() => {
    // Build passports
    const passportRecords = [
      {
        passportId: 101,
        issueDate: '2010-01-01',
        ownerId: 202,
        pictureId: 301,
        picture: { pictureId: 301, filename: 'pic1.jpg' },
      },
      {
        passportId: 102,
        issueDate: '2017-01-01',
        ownerId: 201,
        pictureId: 302,
        picture: { pictureId: 302, filename: 'pic2.jpg' },
      },
      {
        passportId: 103,
        issueDate: '2017-02-05',
        ownerId: null,
        pictureId: 303,
        picture: { pictureId: 303, filename: 'pic3.jpg' },
      },
    ];

    // Build persons
    const personsRecords = [
      { personId: 201, otherId: 201, name: 'Sharon J. Whalen' },
      { personId: 202, otherId: 202, name: 'Mae S. Waldron' },
      { personId: 203, otherId: 203, name: 'Joseph P. Rodriguez' },
    ];

    dataSource = factories.dataSource.buildWithCollections([
      // Build pictures
      // Note that pictures is a native relationship that exists in the underlying
      // datasource.
      factories.collection.build({
        name: 'pictures',
        schema: factories.collectionSchema.build({
          fields: {
            pictureId: factories.columnSchema.numericPrimaryKey().build(),
            filename: factories.columnSchema.build(),
            otherId: factories.columnSchema.build({
              columnType: 'Number',
            }),
          },
        }),
        list: jest.fn().mockRejectedValue(new Error('should never be called')),
        aggregate: jest.fn().mockRejectedValue(new Error('should never be called')),
      }),

      factories.collection.build({
        name: 'passports',
        schema: factories.collectionSchema.build({
          fields: {
            passportId: factories.columnSchema.numericPrimaryKey().build(),
            issueDate: factories.columnSchema.build({ columnType: 'Dateonly' }),
            ownerId: factories.columnSchema.build({
              columnType: 'Number',
              filterOperators: new Set(['In']),
            }),
            pictureId: factories.columnSchema.build({ columnType: 'Number' }),
            picture: factories.manyToOneSchema.build({
              foreignCollection: 'pictures',
              foreignKey: 'pictureId',
            }),
          },
        }),
        list: jest.fn().mockImplementation((_, filter, projection) => {
          let result = passportRecords.slice();
          if (filter?.conditionTree)
            result = filter.conditionTree.apply(result, passports, 'Europe/Paris');
          if (filter?.sort) result = filter.sort.apply(result);

          return projection.apply(result);
        }),
        aggregate: jest.fn().mockImplementation((_, _2, aggregate: Aggregation) => {
          return aggregate.apply(passportRecords, 'Europe/Paris');
        }),
      }),

      factories.collection.build({
        name: 'persons',
        schema: factories.collectionSchema.build({
          fields: {
            personId: factories.columnSchema.numericPrimaryKey().build(),
            otherId: factories.columnSchema.build({
              columnType: 'Number',
              filterOperators: new Set(['In']),
            }),
            name: factories.columnSchema.build({
              columnType: 'String',
              filterOperators: new Set(['In']),
            }),
          },
        }),
        list: jest.fn().mockImplementation((_, filter, projection) => {
          let result = personsRecords.slice();
          if (filter?.conditionTree)
            result = filter.conditionTree.apply(result, persons, 'Europe/Paris');
          if (filter?.sort) result = filter.sort.apply(result);

          return projection.apply(result);
        }),
        aggregate: jest.fn().mockImplementation((_, _2, aggregate: Aggregation) => {
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
    decoratedDataSource = new DataSourceDecorator(dataSource, RelationCollectionDecorator);

    newPassports = decoratedDataSource.getCollection('passports');
    newPersons = decoratedDataSource.getCollection('persons');
  });

  describe('when a one to one is declared', () => {
    describe('missing dependencies', () => {
      test('should throw with a non existent fk', () => {
        expect(() =>
          newPersons.addRelation('persons', {
            type: 'OneToOne',
            foreignCollection: 'passports',
            originKey: '__nonExisting__',
          }),
        ).toThrow("Column not found: 'passports.__nonExisting__'");
      });
    });

    describe('missing operators', () => {
      test('should throw when In is not supported by the fk in the target', () => {
        const schema = passports.schema.fields.ownerId as ColumnSchema;
        schema.filterOperators = new Set();

        expect(() =>
          newPersons.addRelation('passport', {
            type: 'OneToOne',
            foreignCollection: 'passports',
            originKey: 'ownerId',
          }),
        ).toThrow("Column does not support the In operator: 'passports.ownerId'");
      });
    });

    describe('when there is a given originKeyTarget that does not match the target type', () => {
      test('should register the relation', () => {
        expect(() =>
          newPersons.addRelation('passport', {
            type: 'OneToOne',
            foreignCollection: 'passports',
            originKey: 'ownerId',
            originKeyTarget: 'name',
          }),
        ).toThrow("Types from 'passports.ownerId' and 'persons.name' do not match.");
      });
    });

    describe('when there is a given originKeyTarget', () => {
      test('should register the relation', () => {
        expect(() =>
          newPersons.addRelation('passport', {
            type: 'OneToOne',
            foreignCollection: 'passports',
            originKey: 'ownerId',
            originKeyTarget: 'personId',
          }),
        ).not.toThrow();
      });
    });

    describe('when there is not a given originKeyTarget', () => {
      test('should register the relation', () => {
        expect(() =>
          newPersons.addRelation('passport', {
            type: 'OneToOne',
            foreignCollection: 'passports',
            originKey: 'ownerId',
          }),
        ).not.toThrow();
      });
    });
  });

  describe('when a one to many is declared', () => {
    describe('when there is a given originKeyTarget that does not match the target type', () => {
      test('should throw an error', () => {
        expect(() =>
          newPersons.addRelation('passport', {
            type: 'OneToMany',
            foreignCollection: 'passports',
            originKey: 'ownerId',
            originKeyTarget: 'name',
          }),
        ).toThrow("Types from 'passports.ownerId' and 'persons.name' do not match.");
      });
    });

    describe('when there is a given originKeyTarget', () => {
      test('should register the relation', () => {
        expect(() =>
          newPersons.addRelation('passport', {
            type: 'OneToMany',
            foreignCollection: 'passports',
            originKey: 'ownerId',
            originKeyTarget: 'personId',
          }),
        ).not.toThrow();
      });
    });

    describe('when there is not a given originKeyTarget', () => {
      test('should register the relation', () => {
        expect(() =>
          newPersons.addRelation('passport', {
            type: 'OneToMany',
            foreignCollection: 'passports',
            originKey: 'ownerId',
          }),
        ).not.toThrow();
      });
    });
  });

  describe('when a many to one is declared', () => {
    describe('missing dependencies', () => {
      test('should throw with a non existent collection', () => {
        expect(() =>
          newPassports.addRelation('someName', {
            type: 'ManyToOne',
            foreignCollection: '__nonExisting__',
            foreignKey: 'ownerId',
          }),
        ).toThrow("Collection '__nonExisting__' not found.");
      });

      test('should throw with a non existent fk', () => {
        expect(() =>
          newPassports.addRelation('owner', {
            type: 'ManyToOne',
            foreignCollection: 'persons',
            foreignKey: '__nonExisting__',
          }),
        ).toThrow("Column not found: 'passports.__nonExisting__'");
      });
    });

    describe('missing operators', () => {
      test('should throw when In is not supported by the pk in the target', () => {
        const schema = persons.schema.fields.personId as ColumnSchema;
        schema.filterOperators?.clear();

        expect(() =>
          newPassports.addRelation('owner', {
            type: 'ManyToOne',
            foreignCollection: 'persons',
            foreignKey: 'ownerId',
          }),
        ).toThrow("Column does not support the In operator: 'persons.personId'");
      });
    });

    describe('when there is a given foreignKeyTarget', () => {
      test('should register the relation', () => {
        expect(() =>
          newPassports.addRelation('owner', {
            type: 'ManyToOne',
            foreignCollection: 'persons',
            foreignKey: 'ownerId',
            foreignKeyTarget: 'personId',
          }),
        ).not.toThrow();
      });
    });

    describe('when there is not a given foreignKeyTarget', () => {
      test('should register the relation', () => {
        expect(() =>
          newPassports.addRelation('owner', {
            type: 'ManyToOne',
            foreignCollection: 'persons',
            foreignKey: 'ownerId',
          }),
        ).not.toThrow();
      });
    });
  });

  describe('when a many to many is declared', () => {
    describe('missing dependencies', () => {
      test('should throw with a non existent though collection', () => {
        expect(() =>
          newPersons.addRelation('persons', {
            type: 'ManyToMany',
            foreignCollection: 'passports',
            foreignKey: 'ownerId',
            originKey: 'ownerId',
            throughCollection: '__nonExisting__',
          } as ManyToManySchema),
        ).toThrow("Collection '__nonExisting__' not found.");
      });

      test('should throw with a non existent originKey', () => {
        expect(() =>
          newPersons.addRelation('persons', {
            type: 'ManyToMany',
            foreignCollection: 'passports',
            foreignKey: 'ownerId',
            originKey: '__nonExisting__',
            throughCollection: 'passports',
          } as ManyToManySchema),
        ).toThrow("Column not found: 'passports.__nonExisting__'");
      });

      test('should throw with a non existent fk', () => {
        expect(() =>
          newPersons.addRelation('persons', {
            type: 'ManyToMany',
            foreignCollection: 'passports',
            foreignKey: '__nonExisting__',
            originKey: 'ownerId',
            throughCollection: 'passports',
          } as ManyToManySchema),
        ).toThrow("Column not found: 'passports.__nonExisting__'");
      });
    });

    describe('when there is a given originKeyTarget that does not match the target type', () => {
      test('should register the relation', () => {
        expect(() =>
          newPersons.addRelation('persons', {
            type: 'ManyToMany',
            foreignCollection: 'passports',
            foreignKey: 'ownerId',
            originKey: 'ownerId',
            throughCollection: 'passports',
            originKeyTarget: 'name',
            foreignKeyTarget: 'passportId',
          } as ManyToManySchema),
        ).toThrow("Types from 'passports.ownerId' and 'persons.name' do not match.");
      });
    });

    describe('when there are a given originKeyTarget and foreignKeyTarget', () => {
      test('should register the relation', () => {
        expect(() =>
          newPersons.addRelation('persons', {
            type: 'ManyToMany',
            foreignCollection: 'passports',
            foreignKey: 'ownerId',
            originKey: 'ownerId',
            throughCollection: 'passports',
            originKeyTarget: 'personId',
            foreignKeyTarget: 'passportId',
          } as ManyToManySchema),
        ).not.toThrow();
      });
    });

    describe('when there are not a given originKeyTarget and foreignKeyTarget', () => {
      test('should register the relation', () => {
        expect(() =>
          newPersons.addRelation('persons', {
            type: 'ManyToMany',
            foreignCollection: 'passports',
            foreignKey: 'ownerId',
            originKey: 'ownerId',
            throughCollection: 'passports',
          } as ManyToManySchema),
        ).not.toThrow();
      });
    });
  });

  describe('emulated projection', () => {
    test('should fetch fields from a many to one relation', async () => {
      newPassports.addRelation('owner', {
        type: 'ManyToOne',
        foreignCollection: 'persons',
        foreignKey: 'ownerId',
      });

      const records = await newPassports.list(
        factories.caller.build(),
        new Filter({}),
        new Projection('passportId', 'owner:name'),
      );

      expect(records).toStrictEqual([
        { passportId: 101, owner: { name: 'Mae S. Waldron' } },
        { passportId: 102, owner: { name: 'Sharon J. Whalen' } },
        { passportId: 103, owner: null },
      ]);

      // Check that condition tree does NOT contains nulls
      expect(persons.list).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          conditionTree: { field: 'personId', operator: 'In', value: [202, 201] },
        }),
        expect.anything(),
      );
    });

    test('should fetch fields from a one to one relation', async () => {
      newPersons.addRelation('passport', {
        type: 'OneToOne',
        foreignCollection: 'passports',
        originKey: 'ownerId',
        originKeyTarget: 'otherId',
      });

      const records = await newPersons.list(
        factories.caller.build(),
        new Filter({}),
        new Projection('personId', 'name', 'passport:issueDate'),
      );

      expect(records).toStrictEqual([
        { personId: 201, name: 'Sharon J. Whalen', passport: { issueDate: '2017-01-01' } },
        { personId: 202, name: 'Mae S. Waldron', passport: { issueDate: '2010-01-01' } },
        { personId: 203, name: 'Joseph P. Rodriguez', passport: null },
      ]);
    });

    test('should fetch fields from a one to many relation', async () => {
      newPersons.addRelation('passport', {
        type: 'OneToMany',
        foreignCollection: 'passports',
        originKey: 'ownerId',
        originKeyTarget: 'otherId',
      });

      const records = await newPersons.list(
        factories.caller.build(),
        new Filter({}),
        new Projection('personId', 'name', 'passport:issueDate'),
      );

      expect(records).toStrictEqual([
        { personId: 201, name: 'Sharon J. Whalen', passport: { issueDate: '2017-01-01' } },
        { personId: 202, name: 'Mae S. Waldron', passport: { issueDate: '2010-01-01' } },
        { personId: 203, name: 'Joseph P. Rodriguez', passport: null },
      ]);
    });

    test('should fetch fields from a many to many relation', async () => {
      newPersons.addRelation('persons', {
        type: 'ManyToMany',
        foreignCollection: 'persons',
        foreignKey: 'ownerId',
        originKey: 'ownerId',
        throughCollection: 'passports',
        originKeyTarget: 'otherId',
        foreignKeyTarget: 'personId',
      } as ManyToManySchema);

      const records = await newPersons.list(
        factories.caller.build(),
        new Filter({}),
        new Projection('personId', 'name', 'persons:name'),
      );

      expect(records).toStrictEqual([
        { personId: 201, name: 'Sharon J. Whalen', persons: null },
        { personId: 202, name: 'Mae S. Waldron', persons: null },
        { personId: 203, name: 'Joseph P. Rodriguez', persons: null },
      ]);
    });

    test('should fetch fields from a native behind an emulated one', async () => {
      newPersons.addRelation('passport', {
        type: 'OneToOne',
        foreignCollection: 'passports',
        originKey: 'ownerId',
      });
      newPassports.addRelation('owner', {
        type: 'ManyToOne',
        foreignCollection: 'persons',
        foreignKey: 'ownerId',
      });
      const records = await newPersons.list(
        factories.caller.build(),
        new Filter({}),
        new Projection('personId', 'name', 'passport:picture:filename'),
      );

      expect(records).toStrictEqual([
        {
          personId: 201,
          name: 'Sharon J. Whalen',
          passport: { picture: { filename: 'pic2.jpg' } },
        },
        { personId: 202, name: 'Mae S. Waldron', passport: { picture: { filename: 'pic1.jpg' } } },
        { personId: 203, name: 'Joseph P. Rodriguez', passport: null },
      ]);

      // make sure that the emulator did not trigger on native relation
      expect(pictures.list).not.toHaveBeenCalled();
    });

    test('should not break with deep reprojection', async () => {
      newPersons.addRelation('passport', {
        type: 'OneToOne',
        foreignCollection: 'passports',
        originKey: 'ownerId',
      });
      newPassports.addRelation('owner', {
        type: 'ManyToOne',
        foreignCollection: 'persons',
        foreignKey: 'ownerId',
      });
      const records = await newPersons.list(
        factories.caller.build(),
        new Filter({}),
        new Projection('personId', 'name', 'passport:owner:passport:issueDate'),
      );

      expect(records).toStrictEqual([
        {
          personId: 201,
          name: 'Sharon J. Whalen',
          passport: { owner: { passport: { issueDate: '2017-01-01' } } },
        },
        {
          personId: 202,
          name: 'Mae S. Waldron',
          passport: { owner: { passport: { issueDate: '2010-01-01' } } },
        },
        { personId: 203, name: 'Joseph P. Rodriguez', passport: null },
      ]);
    });
  });

  describe('with two emulated relations', () => {
    beforeEach(() => {
      newPersons.addRelation('passport', {
        type: 'OneToOne',
        foreignCollection: 'passports',
        originKey: 'ownerId',
      });

      newPassports.addRelation('owner', {
        type: 'ManyToOne',
        foreignCollection: 'persons',
        foreignKey: 'ownerId',
      });
    });

    describe('emulated filtering', () => {
      test('should filter by a many to one relation', async () => {
        const records = await newPassports.list(
          factories.caller.build(),
          new Filter({
            conditionTree: new ConditionTreeLeaf('owner:name', 'Equal', 'Mae S. Waldron'),
          }),
          new Projection('passportId', 'issueDate'),
        );

        expect(records).toStrictEqual([{ passportId: 101, issueDate: '2010-01-01' }]);
      });

      test('should filter by a one to one relation', async () => {
        const records = await newPersons.list(
          factories.caller.build(),
          new Filter({
            conditionTree: new ConditionTreeLeaf('passport:issueDate', 'Equal', '2017-01-01'),
          }),
          new Projection('personId', 'name'),
        );

        expect(records).toStrictEqual([{ personId: 201, name: 'Sharon J. Whalen' }]);
      });

      test('should filter by native relation behind an emulated one', async () => {
        const records = await newPersons.list(
          factories.caller.build(),
          new Filter({
            conditionTree: new ConditionTreeLeaf('passport:picture:filename', 'Equal', 'pic1.jpg'),
          }),
          new Projection('personId', 'name'),
        );

        expect(records).toStrictEqual([{ personId: 202, name: 'Mae S. Waldron' }]);

        // make sure that the emulator did not trigger on native relation
        expect(pictures.list).not.toHaveBeenCalled();
      });

      test('should not break with deep filters', async () => {
        const records = await newPersons.list(
          factories.caller.build(),
          new Filter({
            conditionTree: new ConditionTreeLeaf(
              'passport:owner:passport:issueDate',
              'Equal',
              '2017-01-01',
            ),
          }),
          new Projection('personId', 'name'),
        );

        expect(records).toStrictEqual([{ personId: 201, name: 'Sharon J. Whalen' }]);
      });
    });

    describe('emulated sorting', () => {
      test('should replace sorts in emulated many to one into sort by fk', async () => {
        // check both sides to make sure we're not getting lucky
        const ascending = await newPassports.list(
          factories.caller.build(),
          new Filter({ sort: new Sort({ field: 'owner:name', ascending: true }) }),
          new Projection('passportId', 'ownerId', 'owner:name'),
        );

        const descending = await newPassports.list(
          factories.caller.build(),
          new Filter({ sort: new Sort({ field: 'owner:name', ascending: false }) }),
          new Projection('passportId', 'ownerId', 'owner:name'),
        );

        expect(ascending).toStrictEqual([
          { passportId: 103, ownerId: null, owner: null },
          { passportId: 102, ownerId: 201, owner: { name: 'Sharon J. Whalen' } },
          { passportId: 101, ownerId: 202, owner: { name: 'Mae S. Waldron' } },
        ]);

        expect(descending).toStrictEqual([
          { passportId: 101, ownerId: 202, owner: { name: 'Mae S. Waldron' } },
          { passportId: 102, ownerId: 201, owner: { name: 'Sharon J. Whalen' } },
          { passportId: 103, ownerId: null, owner: null },
        ]);
      });
    });

    describe('emulated aggregation', () => {
      test("should not emulate aggregation which don't need it", async () => {
        const caller = factories.caller.build();
        const filter = new Filter({});
        const aggregation = new Aggregation({ operation: 'Count', groups: [{ field: 'name' }] });
        const groups = await newPersons.aggregate(caller, filter, aggregation);

        expect(persons.aggregate).toHaveBeenCalledWith(caller, filter, aggregation, undefined);
        expect(groups).toStrictEqual([
          { value: 1, group: { name: 'Sharon J. Whalen' } },
          { value: 1, group: { name: 'Mae S. Waldron' } },
          { value: 1, group: { name: 'Joseph P. Rodriguez' } },
        ]);
      });

      test('should give valid results otherwise', async () => {
        const filter = new Filter({});
        const aggregation = new Aggregation({
          operation: 'Count',
          groups: [{ field: 'passport:picture:filename' }],
        });
        const groups = await newPersons.aggregate(factories.caller.build(), filter, aggregation, 2);

        expect(groups).toStrictEqual([
          { value: 1, group: { 'passport:picture:filename': 'pic2.jpg' } },
          { value: 1, group: { 'passport:picture:filename': 'pic1.jpg' } },
        ]);
      });
    });
  });
});
