/* eslint-disable no-underscore-dangle */

import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';
import {
  Aggregation,
  Aggregator,
  ConditionTree,
  Filter,
  Operator,
  Page,
  Projection,
  Sort,
} from '@forestadmin/datasource-toolkit';
import { Connection, Schema, Types, createConnection, model } from 'mongoose';

import { MongooseDatasource } from '../src';
import MongooseCollection from '../src/collection';

describe('MongooseCollection', () => {
  let connection: Connection;

  const setupReview = async () => {
    const connectionString = 'mongodb://root:password@localhost:27019';
    connection = createConnection(connectionString);

    connection.model(
      'review',
      new Schema({
        title: {
          type: String,
        },
        message: {
          type: String,
        },
        rating: {
          type: Number,
        },
        tags: {
          type: [String],
        },
        createdDate: {
          type: Date,
        },
        modificationDates: {
          type: [Date],
        },
        editorIds: {
          type: [Types.ObjectId],
        },
        authorId: {
          type: Types.ObjectId,
        },
        nestedField: new Schema({ nested: [new Schema({ level: Number })] }),
      }),
    );
    await connection.dropDatabase();
  };

  const setupWithManyToOneRelation = async () => {
    const connectionString = 'mongodb://root:password@localhost:27019';
    connection = createConnection(connectionString);

    connection.model(
      'owner',
      new Schema({
        storeId: {
          type: Types.ObjectId,
          ref: 'store',
        },
        name: {
          type: String,
        },
      }),
    );

    connection.model(
      'store',
      new Schema({
        name: {
          type: String,
        },
        addressId: {
          type: Types.ObjectId,
          ref: 'address',
        },
      }),
    );

    connection.model('address', new Schema({ name: { type: String } }));

    await connection.dropDatabase();
  };

  const setupWith2ManyToManyRelations = async () => {
    const connectionString = 'mongodb://root:password@localhost:27019';
    connection = createConnection(connectionString);

    connection.model(
      'owner',
      new Schema({
        stores: { type: [Schema.Types.ObjectId], ref: 'store' },
        oldStores: { type: [Schema.Types.ObjectId], ref: 'store' },
        name: {
          type: String,
        },
      }),
    );

    connection.model('store', new Schema({ name: { type: String } }));

    await connection.dropDatabase();
  };

  afterEach(async () => {
    await connection?.close();
  });

  it('should build a collection with the right datasource and schema', () => {
    const mockedConnection = { models: {} } as Connection;
    const dataSource = new MongooseDatasource(mockedConnection);

    const carsModel = model('aModel', new Schema({ aField: { type: Number } }));

    const mongooseCollection = new MongooseCollection(dataSource, carsModel);

    expect(mongooseCollection.dataSource).toEqual(dataSource);
    expect(mongooseCollection.name).toEqual('aModel');
    expect(mongooseCollection.schema).toEqual({
      actions: {},
      fields: {
        aField: expect.any(Object),
        _id: expect.any(Object),
      },
      searchable: false,
      segments: [],
    });
  });

  describe('update', () => {
    it('should update the created record', async () => {
      // given
      await setupReview();
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const record = { _id: new Types.ObjectId(), message: 'old message' };
      await review.create(factories.caller.build(), [record]);

      const filter = factories.filter.build({
        conditionTree: factories.conditionTreeLeaf.build({
          field: '_id',
          value: record._id,
          operator: 'Equal',
        }),
      });

      // when
      await review.update(factories.caller.build(), filter, {
        message: 'new message',
      });

      // then
      const updatedRecord = await review.list(
        factories.caller.build(),
        filter,
        new Projection('message'),
      );
      expect(updatedRecord).toEqual([{ message: 'new message' }]);
    });

    describe('with a many to many relation', () => {
      describe('when there is the foreign relation to update', () => {
        it('updates the right id in the array of objectId', async () => {
          // given
          await setupWith2ManyToManyRelations();
          const dataSource = new MongooseDatasource(connection);
          const store = dataSource.getCollection('store');
          const owner = dataSource.getCollection('owner');
          const ownerStore = dataSource.getCollection('owner_store--1');

          const storeRecordA = { _id: new Types.ObjectId(), name: 'A' };
          const storeRecordB = { _id: new Types.ObjectId(), name: 'B' };
          await store.create(factories.caller.build(), [storeRecordA, storeRecordB]);
          const ownerRecordA = { _id: new Types.ObjectId(), stores: [storeRecordA._id] };
          const ownerRecordB = { _id: new Types.ObjectId() };
          await owner.create(factories.caller.build(), [ownerRecordA, ownerRecordB]);

          // when
          await ownerStore.update(
            factories.caller.build(),
            new Filter({
              conditionTree: factories.conditionTreeBranch.build({
                aggregator: 'And',
                conditions: [
                  factories.conditionTreeLeaf.build({
                    value: ownerRecordA._id,
                    operator: 'Equal',
                    field: 'owner_id',
                  }),
                  factories.conditionTreeLeaf.build({
                    value: storeRecordA._id,
                    operator: 'Equal',
                    field: 'store_id',
                  }),
                ],
              }),
            }),

            { owner_id: ownerRecordA._id, store_id: storeRecordB._id },
          );

          // then

          const expectedOwnerStore = await ownerStore.list(
            factories.caller.build(),
            factories.filter.build(),
            new Projection('store_id', 'owner_id'),
          );
          expect(expectedOwnerStore).toEqual([
            { owner_id: ownerRecordA._id, store_id: storeRecordB._id },
          ]);
        });
      });

      describe('when there is the origin and the foreign relation to update', () => {
        it('moves the right id to the right record', async () => {
          // given
          await setupWith2ManyToManyRelations();
          const dataSource = new MongooseDatasource(connection);
          const store = dataSource.getCollection('store');
          const owner = dataSource.getCollection('owner');
          const ownerStore = dataSource.getCollection('owner_store--1');

          const storeRecordA = { _id: new Types.ObjectId(), name: 'A' };
          const storeRecordB = { _id: new Types.ObjectId(), name: 'B' };
          await store.create(factories.caller.build(), [storeRecordA, storeRecordB]);

          const ownerRecordA = { _id: new Types.ObjectId(), stores: [storeRecordA._id] };
          const ownerRecordB = { _id: new Types.ObjectId() };
          await owner.create(factories.caller.build(), [ownerRecordA, ownerRecordB]);

          // when
          await ownerStore.update(
            factories.caller.build(),
            new Filter({
              conditionTree: factories.conditionTreeBranch.build({
                aggregator: 'And',
                conditions: [
                  factories.conditionTreeLeaf.build({
                    value: ownerRecordA._id,
                    operator: 'Equal',
                    field: 'owner_id',
                  }),
                  factories.conditionTreeLeaf.build({
                    value: storeRecordA._id,
                    operator: 'Equal',
                    field: 'store_id',
                  }),
                ],
              }),
            }),

            { owner_id: ownerRecordB._id, store_id: storeRecordB._id },
          );

          // then

          const expectedOwnerStore = await ownerStore.list(
            factories.caller.build(),
            factories.filter.build(),
            new Projection('store_id', 'owner_id'),
          );
          expect(expectedOwnerStore).toEqual([
            { owner_id: ownerRecordB._id, store_id: storeRecordB._id },
          ]);
        });
      });
    });
  });

  describe('delete', () => {
    it('should delete the created record', async () => {
      // given
      await setupReview();
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const record = { _id: new Types.ObjectId(), message: 'old message' };
      await review.create(factories.caller.build(), [record]);

      const filter = factories.filter.build({
        conditionTree: factories.conditionTreeLeaf.build({
          field: '_id',
          value: record._id,
          operator: 'Equal',
        }),
      });

      // when
      await review.delete(factories.caller.build(), filter);

      // then
      const updatedRecord = await review.list(factories.caller.build(), filter, new Projection());
      expect(updatedRecord).toEqual([]);
    });
  });

  describe('list', () => {
    describe('page', () => {
      it('should returns the expected list by given a skip and limit', async () => {
        await setupReview();
        const dataSource = new MongooseDatasource(connection);
        const review = dataSource.getCollection('review');
        const expectedRecordC = { message: 'C' };
        const expectedRecordB = { message: 'B' };
        const expectedRecordA = { message: 'A' };
        await review.create(factories.caller.build(), [
          expectedRecordC,
          expectedRecordB,
          expectedRecordA,
        ]);

        const records = await review.list(
          factories.caller.build(),
          factories.filter.build({
            page: new Page(1, 1),
          }),
          new Projection('message'),
        );

        expect(records).toEqual([{ message: 'B' }]);
      });
    });

    describe('sort', () => {
      it('should sort the records by ascending', async () => {
        await setupReview();
        const dataSource = new MongooseDatasource(connection);
        const review = dataSource.getCollection('review');
        const expectedRecordC = { message: 'C' };
        const expectedRecordB = { message: 'B' };
        const expectedRecordA = { message: 'A' };
        await review.create(factories.caller.build(), [
          expectedRecordC,
          expectedRecordB,
          expectedRecordA,
        ]);

        const records = await review.list(
          factories.caller.build(),
          factories.filter.build({
            sort: new Sort({ field: 'message', ascending: true }),
          }),
          new Projection('message'),
        );

        expect(records).toEqual([{ message: 'A' }, { message: 'B' }, { message: 'C' }]);
      });

      it('should sort the records by descending', async () => {
        await setupReview();
        const dataSource = new MongooseDatasource(connection);
        const review = dataSource.getCollection('review');
        const expectedRecordC = { message: 'C' };
        const expectedRecordB = { message: 'B' };
        const expectedRecordA = { message: 'A' };
        await review.create(factories.caller.build(), [
          expectedRecordC,
          expectedRecordB,
          expectedRecordA,
        ]);

        const records = await review.list(
          factories.caller.build(),
          factories.filter.build({
            sort: new Sort({ field: 'message', ascending: false }),
          }),
          new Projection('message'),
        );

        expect(records).toEqual([{ message: 'C' }, { message: 'B' }, { message: 'A' }]);
      });

      describe('with a many to one relation', () => {
        it('applies correctly the sort when it sorts on a relation field', async () => {
          await setupWithManyToOneRelation();
          const dataSource = new MongooseDatasource(connection);
          const store = dataSource.getCollection('store');
          const owner = dataSource.getCollection('owner');

          const storeRecordA = { _id: new Types.ObjectId(), name: 'A' };
          const storeRecordB = { _id: new Types.ObjectId(), name: 'B' };
          await store.create(factories.caller.build(), [storeRecordA, storeRecordB]);
          const ownerRecordA = {
            _id: new Types.ObjectId(),

            storeId: storeRecordA._id,
            name: 'the second',
          };
          const ownerRecordB = {
            _id: new Types.ObjectId(),

            storeId: storeRecordB._id,
            name: 'the first',
          };
          await owner.create(factories.caller.build(), [ownerRecordA, ownerRecordB]);

          const expectedOwner = await owner.list(
            factories.caller.build(),
            factories.filter.build({
              sort: new Sort({ field: 'storeId__manyToOne--1:name', ascending: false }),
            }),
            new Projection('name'),
          );

          expect(expectedOwner).toEqual([{ name: 'the first' }, { name: 'the second' }]);
        });
      });
    });

    describe('projection', () => {
      it('should return the given record with the given projection', async () => {
        await setupReview();
        const dataSource = new MongooseDatasource(connection);
        const review = dataSource.getCollection('review');
        const expectedRecord = { message: 'a message', title: 'a title' };
        await review.create(factories.caller.build(), [expectedRecord]);

        const records = await review.list(
          factories.caller.build(),
          factories.filter.build(),
          new Projection('message'),
        );

        expect(records).toEqual([{ message: 'a message' }]);
      });

      describe('with a many to one relation', () => {
        describe('when projection is empty', () => {
          it('should return all the records with the relation', async () => {
            await setupWithManyToOneRelation();
            const dataSource = new MongooseDatasource(connection);
            const store = dataSource.getCollection('store');
            const owner = dataSource.getCollection('owner');

            const storeRecord = { _id: new Types.ObjectId(), name: 'aStore' };
            await store.create(factories.caller.build(), [storeRecord]);
            const ownerRecord = {
              _id: new Types.ObjectId(),
              storeId: storeRecord._id,
              name: 'aOwner',
            };
            await owner.create(factories.caller.build(), [ownerRecord]);

            const expectedOwner = await owner.list(
              factories.caller.build(),
              factories.filter.build(),
              new Projection(),
            );

            expect(expectedOwner).toEqual([
              { ...ownerRecord, 'storeId__manyToOne--1': storeRecord },
            ]);
          });
        });

        describe('when projection provide the relation', () => {
          it('should return the relation and the provided field', async () => {
            await setupWithManyToOneRelation();
            const dataSource = new MongooseDatasource(connection);
            const store = dataSource.getCollection('store');
            const owner = dataSource.getCollection('owner');

            const storeRecord = { _id: new Types.ObjectId(), name: 'aStore' };
            await store.create(factories.caller.build(), [storeRecord]);
            const ownerRecord = {
              _id: new Types.ObjectId(),
              storeId: storeRecord._id,
              name: 'aOwner',
            };
            await owner.create(factories.caller.build(), [ownerRecord]);

            const expectedOwner = await owner.list(
              factories.caller.build(),
              factories.filter.build(),
              new Projection('name', 'storeId__manyToOne--1:name'),
            );

            expect(expectedOwner).toEqual([
              { name: 'aOwner', 'storeId__manyToOne--1': { name: 'aStore' } },
            ]);
          });

          describe('when some record does not have relation', () => {
            it('should return the relation and the provided field', async () => {
              await setupWithManyToOneRelation();
              const dataSource = new MongooseDatasource(connection);
              const store = dataSource.getCollection('store');
              const owner = dataSource.getCollection('owner');

              const storeRecord = { _id: new Types.ObjectId(), name: 'aStore' };
              await store.create(factories.caller.build(), [storeRecord]);
              const ownerRecord = {
                _id: new Types.ObjectId(),
                storeId: null,
                name: 'aOwner',
              };
              await owner.create(factories.caller.build(), [ownerRecord]);

              const expectedOwner = await owner.list(
                factories.caller.build(),
                factories.filter.build(),
                new Projection('name', 'storeId_manyToOne:name'),
              );

              expect(expectedOwner).toEqual([{ name: 'aOwner' }]);
            });
          });
        });
      });
    });

    describe('condition tree', () => {
      describe('operators', () => {
        const cases: [ConditionTree, Projection, unknown][] = [
          [
            factories.conditionTreeLeaf.build({
              value: ['00000003411bcba43b97a6fb'],
              operator: 'In',
              field: 'editorIds',
            }),
            new Projection('editorIds'),
            [
              {
                editorIds: [
                  new Types.ObjectId('000000017578d48e343067c3'),
                  new Types.ObjectId('00000003411bcba43b97a6fb'),
                ],
              },
            ],
          ],
          [
            factories.conditionTreeLeaf.build({
              value: ['000000017578d48e343067c3', '00000003411bcba43b97a6fb'],
              operator: 'Equal',
              field: 'editorIds',
            }),
            new Projection('editorIds'),
            [
              {
                editorIds: [
                  new Types.ObjectId('000000017578d48e343067c3'),
                  new Types.ObjectId('00000003411bcba43b97a6fb'),
                ],
              },
            ],
          ],
          [
            factories.conditionTreeLeaf.build({
              value: ['2016-02-29'],
              operator: 'In',
              field: 'modificationDates',
            }),
            new Projection('modificationDates'),
            [{ modificationDates: [new Date('2016-02-31'), new Date('2016-02-29')] }],
          ],
          [
            factories.conditionTreeLeaf.build({
              value: '2016-02-31',
              operator: 'LessThan',
              field: 'createdDate',
            }),
            new Projection('createdDate'),
            [{ createdDate: new Date('2015-02-31') }],
          ],
          [
            factories.conditionTreeLeaf.build({
              value: 9,
              operator: 'GreaterThan',
              field: 'rating',
            }),
            new Projection('rating'),
            [{ rating: 10 }],
          ],
          [
            factories.conditionTreeLeaf.build({
              value: 9,
              operator: 'LessThan',
              field: 'rating',
            }),
            new Projection('rating'),
            [{ rating: 5 }],
          ],
          [
            factories.conditionTreeLeaf.build({
              value: 10,
              operator: 'Equal',
              field: 'rating',
            }),
            new Projection('rating'),
            [{ rating: 10 }],
          ],
          [
            factories.conditionTreeLeaf.build({
              value: 10,
              operator: 'NotEqual',
              field: 'rating',
            }),
            new Projection('rating'),
            [{ rating: 5 }],
          ],
          [
            factories.conditionTreeLeaf.build({
              value: [10, 5],
              operator: 'In',
              field: 'rating',
            }),
            new Projection('rating'),
            [{ rating: 10 }, { rating: 5 }],
          ],
          [
            factories.conditionTreeLeaf.build({
              value: ['A', 'B'],
              operator: 'IncludesAll',
              field: 'tags',
            }),
            new Projection('tags'),
            [{ tags: ['A', 'B'] }],
          ],
          [
            factories.conditionTreeLeaf.build({
              value: ['A'],
              operator: 'Contains',
              field: 'tags',
            }),
            new Projection('tags'),
            [{ tags: ['A', 'B'] }],
          ],
          [
            factories.conditionTreeLeaf.build({
              value: ['A'],
              operator: 'NotContains',
              field: 'tags',
            }),
            new Projection('tags'),
            [{ tags: ['B', 'C'] }],
          ],
          [
            factories.conditionTreeLeaf.build({
              value: '%message%',
              operator: 'Like',
              field: 'message',
            }),
            new Projection('message'),
            [{ message: 'a message' }, { message: 'message' }],
          ],
          [
            factories.conditionTreeLeaf.build({
              operator: 'Present',
              field: 'title',
            }),
            new Projection('title'),
            [{ title: 'a title' }],
          ],
        ];

        it.each(cases)(
          '[%p] should support the operator',
          async (conditionTree, projection, expectedResult) => {
            await setupReview();
            const dataSource = new MongooseDatasource(connection);
            const review = dataSource.getCollection('review');
            const record1 = {
              message: 'a message',
              title: 'a title',
              rating: 10,
              nestedField: { nested: [{ level: 10 }] },
              createdDate: new Date('2016-02-31'),
              tags: ['A', 'B'],
              modificationDates: ['2016-02-31', '2016-02-30'],
              editorIds: [
                new Types.ObjectId('000000017578d48e343067c3'),
                new Types.ObjectId('000000017578d48e343067c9'),
              ],
            };
            const record2 = {
              message: 'message',
              title: null,
              rating: 5,
              nestedField: { nested: [{ level: 5 }, { level: 6 }] },
              createdDate: new Date('2015-02-31'),
              tags: ['B', 'C'],
              modificationDates: ['2016-02-31', '2016-02-29'],
              editorIds: [
                new Types.ObjectId('000000017578d48e343067c3'),
                new Types.ObjectId('00000003411bcba43b97a6fb'),
              ],
            };
            await review.create(factories.caller.build(), [record1, record2]);

            const records = await review.list(
              factories.caller.build(),
              factories.filter.build({ conditionTree }),
              projection,
            );

            expect(records).toEqual(expectedResult);
          },
        );

        it('should throw an error when the operator is invalid', async () => {
          await setupReview();
          const dataSource = new MongooseDatasource(connection);
          const review = dataSource.getCollection('review');
          await review.create(factories.caller.build(), [{ message: 'a message' }]);

          await expect(() =>
            review.list(
              factories.caller.build(),
              factories.filter.build({
                conditionTree: factories.conditionTreeLeaf.build({ operator: 'BAD' as Operator }),
              }),
              new Projection(),
            ),
          ).rejects.toThrow("Unsupported 'BAD' operator");
        });

        it('should throw an error when the aggregator is invalid', async () => {
          await setupReview();
          const dataSource = new MongooseDatasource(connection);
          const review = dataSource.getCollection('review');
          await review.create(factories.caller.build(), [{ message: 'a message' }]);

          await expect(() =>
            review.list(
              factories.caller.build(),
              factories.filter.build({
                conditionTree: factories.conditionTreeBranch.build({
                  aggregator: 'BAD' as Aggregator,
                }),
              }),
              new Projection(),
            ),
          ).rejects.toThrow("Invalid 'BAD' aggregator");
        });

        it('supports default operators when the primary key objectId is given', async () => {
          await setupReview();
          const dataSource = new MongooseDatasource(connection);
          const review = dataSource.getCollection('review');
          const targetedId = new Types.ObjectId();
          const expectedRecord = { _id: targetedId };
          const unexpectedRecord = { _id: new Types.ObjectId() };
          await review.create(factories.caller.build(), [expectedRecord, unexpectedRecord]);

          const records = await review.list(
            factories.caller.build(),
            factories.filter.build({
              conditionTree: factories.conditionTreeLeaf.build({
                value: targetedId,
                operator: 'Equal',
                field: '_id',
              }),
            }),
            new Projection('_id'),
          );

          expect(records).toEqual([{ _id: targetedId }]);
        });

        it('supports string operators when the _id as string is given', async () => {
          await setupReview();
          const dataSource = new MongooseDatasource(connection);
          const review = dataSource.getCollection('review');
          const targetedId = new Types.ObjectId();
          const expectedRecord = { _id: targetedId };
          const unexpectedRecord = { _id: new Types.ObjectId() };
          await review.create(factories.caller.build(), [expectedRecord, unexpectedRecord]);

          const records = await review.list(
            factories.caller.build(),
            factories.filter.build({
              conditionTree: factories.conditionTreeLeaf.build({
                value: targetedId.toString(),
                operator: 'Contains',
                field: '_id',
              }),
            }),
            new Projection('_id'),
          );

          expect(records).toEqual([{ _id: targetedId }]);
        });

        it('supports string operators when an objectId is given', async () => {
          await setupReview();
          const dataSource = new MongooseDatasource(connection);
          const review = dataSource.getCollection('review');
          const targetedId = new Types.ObjectId();
          const expectedRecord = { authorId: targetedId };
          const unexpectedRecord = { authorId: new Types.ObjectId() };
          await review.create(factories.caller.build(), [expectedRecord, unexpectedRecord]);

          const records = await review.list(
            factories.caller.build(),
            factories.filter.build({
              conditionTree: factories.conditionTreeLeaf.build({
                value: targetedId.toString(),
                operator: 'Contains',
                field: 'authorId',
              }),
            }),
            new Projection('authorId'),
          );

          expect(records).toEqual([{ authorId: targetedId }]);
        });

        it('supports operators when an [objectId] as string is given', async () => {
          await setupReview();
          const dataSource = new MongooseDatasource(connection);
          const review = dataSource.getCollection('review');
          const targetedId = new Types.ObjectId();
          const expectedRecord = { authorId: targetedId };
          const unexpectedRecord = { authorId: new Types.ObjectId() };
          await review.create(factories.caller.build(), [expectedRecord, unexpectedRecord]);

          const records = await review.list(
            factories.caller.build(),
            factories.filter.build({
              conditionTree: factories.conditionTreeLeaf.build({
                value: [targetedId.toString()],
                operator: 'In',
                field: 'authorId',
              }),
            }),
            new Projection('authorId'),
          );

          expect(records).toEqual([{ authorId: targetedId }]);
        });
      });

      describe('when only a leaf condition is given', () => {
        it('should return the expected list', async () => {
          await setupReview();
          const dataSource = new MongooseDatasource(connection);
          const review = dataSource.getCollection('review');
          const expectedRecord = { message: 'a message' };
          const unexpectedRecord = { message: 'message' };
          await review.create(factories.caller.build(), [expectedRecord, unexpectedRecord]);

          const records = await review.list(
            factories.caller.build(),
            factories.filter.build({
              conditionTree: factories.conditionTreeLeaf.build({
                value: 'a message',
                operator: 'Equal',
                field: 'message',
              }),
            }),
            new Projection('message'),
          );

          expect(records).toEqual([{ message: 'a message' }]);
        });

        it('applies a condition tree on a nested field', async () => {
          await setupReview();
          const dataSource = new MongooseDatasource(connection);
          const review = dataSource.getCollection('review');
          const expectedRecord = { nestedField: { nested: [{ level: 10 }] } };
          const unexpectedRecord = { nestedField: { nested: [{ level: 5 }] } };
          await review.create(factories.caller.build(), [expectedRecord, unexpectedRecord]);

          const records = await review.list(
            factories.caller.build(),
            factories.filter.build({
              conditionTree: factories.conditionTreeLeaf.build({
                value: 9,
                operator: 'GreaterThan',
                field: 'nestedField.nested.level',
              }),
            }),
            new Projection('nestedField.nested.level'),
          );

          expect(records).toEqual([{ nestedField: { nested: [{ level: 10 }] } }]);
        });
      });

      describe('with Or branches', () => {
        it('should return the expected list', async () => {
          await setupReview();
          const dataSource = new MongooseDatasource(connection);
          const review = dataSource.getCollection('review');
          const expectedRecord1 = { message: 'match message 1' };
          const expectedRecord2 = { message: 'match message 2' };
          const unexpectedRecord = { message: 'message', title: 'a title' };
          await review.create(factories.caller.build(), [
            expectedRecord1,
            expectedRecord2,
            unexpectedRecord,
          ]);

          const records = await review.list(
            factories.caller.build(),
            factories.filter.build({
              conditionTree: factories.conditionTreeBranch.build({
                aggregator: 'Or',
                conditions: [
                  factories.conditionTreeLeaf.build({
                    value: 'match message 1',
                    operator: 'Equal',
                    field: 'message',
                  }),
                  factories.conditionTreeLeaf.build({
                    value: 'match message 2',
                    operator: 'Equal',
                    field: 'message',
                  }),
                ],
              }),
            }),
            new Projection('message'),
          );

          expect(records).toEqual([{ message: 'match message 1' }, { message: 'match message 2' }]);
        });
      });

      describe('with And branches', () => {
        it('should return the expected list', async () => {
          await setupReview();
          const dataSource = new MongooseDatasource(connection);
          const review = dataSource.getCollection('review');
          const expectedRecord = { message: 'match message', title: 'a title 1' };
          const unexpectedRecord1 = { message: 'match message', title: 'a title 2' };
          const unexpectedRecord2 = { message: 'message', title: 'a title' };
          await review.create(factories.caller.build(), [
            expectedRecord,
            unexpectedRecord2,
            unexpectedRecord1,
          ]);

          const records = await review.list(
            factories.caller.build(),
            factories.filter.build({
              conditionTree: factories.conditionTreeBranch.build({
                aggregator: 'And',
                conditions: [
                  factories.conditionTreeLeaf.build({
                    value: 'match message',
                    operator: 'Equal',
                    field: 'message',
                  }),
                  factories.conditionTreeLeaf.build({
                    value: 'a title 1',
                    operator: 'Equal',
                    field: 'title',
                  }),
                ],
              }),
            }),
            new Projection('message', 'title'),
          );

          expect(records).toEqual([{ message: 'match message', title: 'a title 1' }]);
        });
      });

      describe('with a many to one relation', () => {
        it('applies correctly the condition tree', async () => {
          await setupWithManyToOneRelation();
          const dataSource = new MongooseDatasource(connection);
          const store = dataSource.getCollection('store');
          const owner = dataSource.getCollection('owner');

          const storeRecordA = { _id: new Types.ObjectId(), name: 'A' };
          const storeRecordB = { _id: new Types.ObjectId(), name: 'B' };
          await store.create(factories.caller.build(), [storeRecordA, storeRecordB]);
          const ownerRecordA = {
            _id: new Types.ObjectId(),
            storeId: storeRecordA._id,
            name: 'owner with the store A',
          };
          const ownerRecordB = {
            _id: new Types.ObjectId(),
            storeId: storeRecordB._id,
            name: 'owner with the store B',
          };
          await owner.create(factories.caller.build(), [ownerRecordA, ownerRecordB]);

          const expectedOwner = await owner.list(
            factories.caller.build(),
            factories.filter.build({
              conditionTree: factories.conditionTreeLeaf.build({
                value: 'A',
                operator: 'Equal',
                field: 'storeId__manyToOne--1:name',
              }),
            }),
            new Projection('name'),
          );

          expect(expectedOwner).toEqual([{ name: 'owner with the store A' }]);
        });
      });

      describe('with a many to many relation', () => {
        it('applies correctly the condition tree', async () => {
          await setupWith2ManyToManyRelations();
          const dataSource = new MongooseDatasource(connection);
          const store = dataSource.getCollection('store');
          const owner = dataSource.getCollection('owner');
          const ownerStore = dataSource.getCollection('owner_store--1');

          const storeRecordA = { _id: new Types.ObjectId(), name: 'A' };
          const storeRecordB = { _id: new Types.ObjectId(), name: 'B' };
          await store.create(factories.caller.build(), [storeRecordA, storeRecordB]);
          const ownerRecordA = {
            _id: new Types.ObjectId(),
            stores: [storeRecordA._id, storeRecordB._id],
            name: 'owner with the store A and B',
          };
          const ownerRecordB = {
            _id: new Types.ObjectId(),
            stores: [storeRecordB._id],
            name: 'owner with the store B',
          };
          await owner.create(factories.caller.build(), [ownerRecordA, ownerRecordB]);

          const expectedOwner = await ownerStore.list(
            factories.caller.build(),
            factories.filter.build({
              conditionTree: factories.conditionTreeLeaf.build({
                value: storeRecordA._id,
                operator: 'Equal',
                field: 'store_id',
              }),
            }),
            new Projection('store_id'),
          );

          expect(expectedOwner).toEqual([{ store_id: storeRecordA._id }]);
        });
      });

      describe('with a deep many to one relation', () => {
        it('applies correctly the condition tree', async () => {
          await setupWithManyToOneRelation();
          const dataSource = new MongooseDatasource(connection);
          const store = dataSource.getCollection('store');
          const owner = dataSource.getCollection('owner');
          const address = dataSource.getCollection('address');

          const addressRecordA = { _id: new Types.ObjectId(), name: 'A' };
          const addressRecordB = { _id: new Types.ObjectId(), name: 'B' };
          await address.create(factories.caller.build(), [addressRecordA, addressRecordB]);

          const storeRecordA = {
            _id: new Types.ObjectId(),
            name: 'A',
            addressId: addressRecordA._id,
          };
          const storeRecordB = {
            _id: new Types.ObjectId(),
            name: 'B',
            addressId: addressRecordB._id,
          };
          await store.create(factories.caller.build(), [storeRecordA, storeRecordB]);

          const ownerRecordA = {
            _id: new Types.ObjectId(),

            storeId: storeRecordA._id,
            name: 'owner with the store address A',
          };
          const ownerRecordB = {
            _id: new Types.ObjectId(),
            storeId: storeRecordB._id,
            name: 'owner with the store address B',
          };
          await owner.create(factories.caller.build(), [ownerRecordA, ownerRecordB]);

          const expectedOwner = await owner.list(
            factories.caller.build(),
            factories.filter.build({
              conditionTree: factories.conditionTreeLeaf.build({
                value: 'A',
                operator: 'Equal',
                field: 'storeId__manyToOne--1:addressId__manyToOne--1:name',
              }),
            }),
            new Projection(),
          );

          expect(expectedOwner).toEqual([
            {
              _id: expect.any(Object),
              storeId: expect.any(Object),
              name: 'owner with the store address A',
              'storeId__manyToOne--1': {
                _id: expect.any(Object),
                name: 'A',
                addressId: expect.any(Object),
                'addressId__manyToOne--1': {
                  _id: expect.any(Object),
                  name: 'A',
                },
              },
            },
          ]);
        });
      });
    });
  });

  describe('create', () => {
    it('should return the list of the created records', async () => {
      await setupReview();
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const expectedRecord = {
        message: 'a message',
        title: 'a title',
        tags: ['A'],
        modificationDates: [],
        editorIds: [],
      };

      const records = await review.create(factories.caller.build(), [
        expectedRecord,
        expectedRecord,
        expectedRecord,
      ]);

      expect(records).toEqual([
        { ...expectedRecord, _id: expect.any(Object) },
        { ...expectedRecord, _id: expect.any(Object) },
        { ...expectedRecord, _id: expect.any(Object) },
      ]);
      const persistedRecord = await connection.models.review.find();
      expect(persistedRecord).toHaveLength(3);
    });

    describe('when there are nested records', () => {
      it('returns the created nested records without the mongoose _id', async () => {
        await setupReview();
        const dataSource = new MongooseDatasource(connection);
        const review = dataSource.getCollection('review');
        const data = {
          message: 'a message',
          title: 'a title',
          nestedField: { nested: [{ level: 10 }] },
        };

        const records = await review.create(factories.caller.build(), [data, data, data]);

        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        expect(records[0].nestedField.nested).toEqual([{ level: 10 }]);

        const persistedRecord = await connection.models.review.find();
        expect(persistedRecord).toHaveLength(3);
      });

      describe('when the nested record is a JSON', () => {
        it('returns the list of the created nested records', async () => {
          await setupReview();
          const dataSource = new MongooseDatasource(connection);
          const review = dataSource.getCollection('review');
          const data = {
            message: 'a message',
            title: 'a title',
            nestedField: JSON.stringify({ nested: [{ level: 10 }] }),
          };

          const records = await review.create(factories.caller.build(), [data, data, data]);

          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          expect(records[0].nestedField.nested).toEqual([{ level: 10 }]);

          const persistedRecord = await connection.models.review.find();
          expect(persistedRecord).toHaveLength(3);
        });
      });
    });
  });

  describe('aggregate', () => {
    it('applies an aggregation operator on a relation field', async () => {
      await setupWithManyToOneRelation();
      const dataSource = new MongooseDatasource(connection);
      const store = dataSource.getCollection('store');
      const owner = dataSource.getCollection('owner');

      const storeRecordA = { _id: new Types.ObjectId(), name: 'A' };
      const storeRecordB = { _id: new Types.ObjectId(), name: 'B' };
      await store.create(factories.caller.build(), [storeRecordA, storeRecordB]);
      const ownerRecordA = {
        storeId: storeRecordA._id,
      };
      const ownerRecordB = {
        storeId: storeRecordB._id,
      };
      await owner.create(factories.caller.build(), [ownerRecordA, ownerRecordB]);

      const aggregation = new Aggregation({
        operation: 'Max',
        field: 'storeId__manyToOne--1:name',
      });
      const records = await owner.aggregate(factories.caller.build(), new Filter({}), aggregation);

      expect(records).toIncludeSameMembers([{ value: 'B', group: {} }]);
    });

    it('applies a group on a relation field', async () => {
      await setupWithManyToOneRelation();
      const dataSource = new MongooseDatasource(connection);
      const store = dataSource.getCollection('store');
      const owner = dataSource.getCollection('owner');

      const storeRecordA = { _id: new Types.ObjectId(), name: 'A' };
      const storeRecordB = { _id: new Types.ObjectId(), name: 'B' };
      await store.create(factories.caller.build(), [storeRecordA, storeRecordB]);
      const ownerRecordA = {
        storeId: storeRecordA._id,
      };
      const ownerRecordB = {
        storeId: storeRecordB._id,
      };
      await owner.create(factories.caller.build(), [ownerRecordA, ownerRecordA, ownerRecordB]);

      const aggregation = new Aggregation({
        operation: 'Count',
        field: 'storeId_manyToOne:name',
        groups: [{ field: 'storeId__manyToOne--1:name' }],
      });
      const records = await owner.aggregate(factories.caller.build(), new Filter({}), aggregation);

      expect(records).toIncludeSameMembers([
        { group: { 'storeId__manyToOne--1.name': 'A' }, value: 2 },
        { group: { 'storeId__manyToOne--1.name': 'B' }, value: 1 },
      ]);
    });

    it('applies Limit on the results', async () => {
      await setupReview();
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const rating1 = { rating: 1, message: 'message 1' };
      const rating2 = { rating: 2, message: 'message 1' };
      const rating3 = { rating: 15, message: 'message 2' };
      await review.create(factories.caller.build(), [rating1, rating2, rating3]);

      const aggregation = new Aggregation({
        operation: 'Max',
        field: 'rating',
        groups: [{ field: 'message' }],
      });
      const limit = 1;
      const records = await review.aggregate(
        factories.caller.build(),
        new Filter({}),
        aggregation,
        limit,
      );

      expect(records).toHaveLength(limit);
    });

    it('applies Max on a field', async () => {
      await setupReview();
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const rating1 = { rating: 1 };
      const rating2 = { rating: 2 };
      const rating3 = { rating: 15 };
      await review.create(factories.caller.build(), [rating1, rating2, rating3]);

      const aggregation = new Aggregation({
        operation: 'Max',
        field: 'rating',
      });
      const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

      expect(records).toIncludeSameMembers([{ value: 15, group: {} }]);
    });

    it('applies Max on a field with grouping', async () => {
      await setupReview();
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const rating1 = { rating: 1, message: 'message 1' };
      const rating2 = { rating: 2, message: 'message 1' };
      const rating3 = { rating: 15, message: 'message 2' };
      await review.create(factories.caller.build(), [rating1, rating2, rating3]);

      const aggregation = new Aggregation({
        operation: 'Max',
        field: 'rating',
        groups: [{ field: 'message' }],
      });
      const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

      expect(records).toIncludeSameMembers([
        { group: { message: 'message 2' }, value: 15 },
        { group: { message: 'message 1' }, value: 2 },
      ]);
    });

    it('applies Min on a field', async () => {
      await setupReview();
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const rating1 = { rating: 1 };
      const rating2 = { rating: 2 };
      const rating3 = { rating: 15 };
      await review.create(factories.caller.build(), [rating1, rating2, rating3]);

      const aggregation = new Aggregation({
        operation: 'Min',
        field: 'rating',
      });
      const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

      expect(records).toIncludeSameMembers([{ value: 1, group: {} }]);
    });

    it('applies Min on a field with grouping', async () => {
      await setupReview();
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const rating1 = { rating: 1, message: 'message 1' };
      const rating2 = { rating: 2, message: 'message 1' };
      const rating3 = { rating: 15, message: 'message 2' };
      await review.create(factories.caller.build(), [rating1, rating2, rating3]);

      const aggregation = new Aggregation({
        operation: 'Min',
        field: 'rating',
        groups: [{ field: 'message' }],
      });
      const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

      expect(records).toIncludeSameMembers([
        { group: { message: 'message 2' }, value: 15 },
        { group: { message: 'message 1' }, value: 1 },
      ]);
    });

    it('applies Count', async () => {
      await setupReview();
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const message1 = { title: 'present', message: 'message 1' };
      const message2 = { title: 'present', message: 'message 2' };
      const message3 = { title: null, message: 'message 3' };
      await review.create(factories.caller.build(), [message1, message1, message2, message3]);

      const aggregation = new Aggregation({
        operation: 'Count',
        field: 'title',
      });
      const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

      expect(records).toIncludeSameMembers([{ value: 3, group: {} }]);
    });

    it('applies Count on a field with grouping', async () => {
      await setupReview();
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const message1 = { title: 'present', message: 'message 1' };
      const message2 = { title: 'present', message: 'message 2' };
      const message3 = { title: null, message: 'message 3' };
      await review.create(factories.caller.build(), [message1, message1, message2, message3]);

      const aggregation = new Aggregation({
        operation: 'Count',
        field: 'title',
        groups: [{ field: 'message' }],
      });
      const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

      expect(records).toIncludeSameMembers([
        { value: 2, group: { message: 'message 1' } },
        { value: 1, group: { message: 'message 2' } },
        { value: 0, group: { message: 'message 3' } },
      ]);
    });

    it('applies Count on the record with grouping', async () => {
      await setupReview();
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const message1 = { message: 'message 1' };
      const message2 = { message: 'message 2' };
      await review.create(factories.caller.build(), [message1, message1, message2]);

      const aggregation = new Aggregation({
        operation: 'Count',
        groups: [{ field: 'message' }],
      });
      const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

      expect(records).toIncludeSameMembers([
        { value: 2, group: { message: 'message 1' } },
        { value: 1, group: { message: 'message 2' } },
      ]);
    });

    it('applies Count without providing a field', async () => {
      await setupReview();
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const rating1 = { rating: 1 };
      const rating2 = { rating: 2 };
      const rating3 = { rating: 15 };
      await review.create(factories.caller.build(), [rating1, rating2, rating3]);

      const aggregation = new Aggregation({
        operation: 'Count',
      });
      const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

      expect(records).toIncludeSameMembers([{ value: 3, group: {} }]);
    });

    it('applies Sum on a field', async () => {
      await setupReview();
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const rating1 = { createdDate: new Date('2022-01-13'), rating: 5 };
      const rating2 = { createdDate: new Date('2022-02-13'), rating: 1 };
      const rating3 = { createdDate: new Date('2023-03-14'), rating: 3 };
      await review.create(factories.caller.build(), [rating1, rating2, rating3]);

      const aggregation = new Aggregation({
        operation: 'Sum',
        field: 'rating',
        groups: [{ field: 'createdDate', operation: 'Year' }],
      });
      const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

      expect(records).toIncludeSameMembers([
        { group: { createdDate: '2023-01-01' }, value: 3 },
        { group: { createdDate: '2022-01-01' }, value: 6 },
      ]);
    });

    it('applies Sum on a field with grouping and Month operator', async () => {
      await setupReview();
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const rating1 = { createdDate: new Date('2022-01-13'), rating: 5 };
      const rating2 = { createdDate: new Date('2022-02-13'), rating: 1 };
      const rating3 = { createdDate: new Date('2023-03-14'), rating: 3 };
      await review.create(factories.caller.build(), [rating1, rating2, rating3]);

      const aggregation = new Aggregation({
        operation: 'Sum',
        field: 'rating',
        groups: [{ field: 'createdDate', operation: 'Month' }],
      });
      const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

      expect(records).toIncludeSameMembers([
        { group: { createdDate: '2022-02-01' }, value: 1 },
        { group: { createdDate: '2023-03-01' }, value: 3 },
        { group: { createdDate: '2022-01-01' }, value: 5 },
      ]);
    });

    it('applies Sum on a field with grouping and Day operator', async () => {
      await setupReview();
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const rating1 = { createdDate: new Date('2022-01-13'), rating: 5 };
      const rating2 = { createdDate: new Date('2022-02-13'), rating: 1 };
      const rating3 = { createdDate: new Date('2023-03-14'), rating: 3 };
      await review.create(factories.caller.build(), [rating1, rating2, rating3]);

      const aggregation = new Aggregation({
        operation: 'Sum',
        field: 'rating',
        groups: [{ field: 'createdDate', operation: 'Day' }],
      });
      const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

      expect(records).toIncludeSameMembers([
        { group: { createdDate: '2022-02-13' }, value: 1 },
        { group: { createdDate: '2022-01-13' }, value: 5 },
        { group: { createdDate: '2023-03-14' }, value: 3 },
      ]);
    });

    it('applies Sum on a field with grouping and Week operator', async () => {
      await setupReview();
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const rating1 = { createdDate: new Date('2022-01-13'), rating: 5 };
      const rating2 = { createdDate: new Date('2022-03-15'), rating: 1 };
      const rating3 = { createdDate: new Date('2022-03-14'), rating: 3 };
      await review.create(factories.caller.build(), [rating1, rating2, rating3]);

      const aggregation = new Aggregation({
        operation: 'Sum',
        field: 'rating',
        groups: [{ field: 'createdDate', operation: 'Week' }],
      });
      const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

      expect(records).toIncludeSameMembers([
        { group: { createdDate: '2022-01-10' }, value: 5 },
        { group: { createdDate: '2022-03-14' }, value: 4 },
      ]);
    });

    it('applies Avg on a field with grouping and Week operator', async () => {
      await setupReview();
      const dataSource = new MongooseDatasource(connection);
      const review = dataSource.getCollection('review');
      const rating1 = { createdDate: new Date('2022-01-13'), rating: 5 };
      const rating2 = { createdDate: new Date('2022-03-15'), rating: 1 };
      const rating3 = { createdDate: new Date('2022-03-14'), rating: 3 };
      await review.create(factories.caller.build(), [rating1, rating2, rating3]);

      const aggregation = new Aggregation({
        operation: 'Avg',
        field: 'rating',
        groups: [{ field: 'createdDate', operation: 'Week' }],
      });
      const records = await review.aggregate(factories.caller.build(), new Filter({}), aggregation);

      expect(records).toIncludeSameMembers([
        { group: { createdDate: '2022-01-10' }, value: 5 },
        { group: { createdDate: '2022-03-14' }, value: (3 + 1) / 2 },
      ]);
    });

    describe('when there are multiple groups', () => {
      it('should apply all the given group', async () => {
        await setupReview();
        const dataSource = new MongooseDatasource(connection);
        const review = dataSource.getCollection('review');
        const message1 = { title: 'title 1', message: 'message 1' };
        const message2 = { title: 'title 1', message: 'message 1' };
        const message3 = { title: 'title 2', message: 'message 1' };
        const message4 = { title: 'title 3', message: 'message 2' };
        await review.create(factories.caller.build(), [message1, message2, message3, message4]);

        const aggregation = new Aggregation({
          operation: 'Count',
          field: 'title',
          groups: [{ field: 'message' }, { field: 'title' }],
        });
        const records = await review.aggregate(
          factories.caller.build(),
          new Filter({}),
          aggregation,
        );

        expect(records).toIncludeSameMembers([
          { value: 2, group: { message: 'message 1', title: 'title 1' } },
          { value: 1, group: { message: 'message 1', title: 'title 2' } },
          { value: 1, group: { message: 'message 2', title: 'title 3' } },
        ]);
      });
    });

    describe('with a many to many', () => {
      it('applies correctly the aggregation', async () => {
        await setupWith2ManyToManyRelations();
        const dataSource = new MongooseDatasource(connection);
        const store = dataSource.getCollection('store');
        const owner = dataSource.getCollection('owner');
        const ownerStore = dataSource.getCollection('owner_store--1');

        const storeRecordA = { _id: new Types.ObjectId(), name: 'A' };
        const storeRecordB = { _id: new Types.ObjectId(), name: 'B' };
        await store.create(factories.caller.build(), [storeRecordA, storeRecordB]);
        const ownerRecordA = {
          _id: new Types.ObjectId(),
          stores: [storeRecordA._id, storeRecordB._id],
          name: 'owner with the store A and B',
        };
        const ownerRecordB = {
          _id: new Types.ObjectId(),
          stores: [storeRecordB._id],
          name: 'owner with the store B',
        };
        await owner.create(factories.caller.build(), [ownerRecordA, ownerRecordB]);

        const aggregation = new Aggregation({
          operation: 'Count',
          groups: [],
        });
        const expectedCount = await ownerStore.aggregate(
          factories.caller.build(),
          factories.filter.build({
            conditionTree: factories.conditionTreeLeaf.build({
              value: storeRecordA._id,
              operator: 'Equal',
              field: 'store_id',
            }),
          }),
          aggregation,
        );

        expect(expectedCount).toEqual([{ value: 1, group: {} }]);
      });
    });
  });
});
