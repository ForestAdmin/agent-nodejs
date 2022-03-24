import * as factories from '../../__factories__';
import { ColumnSchema, PrimitiveTypes } from '../../../src/interfaces/schema';
import { Filter, PaginatedFilter } from '../../../src';
import { Operator } from '../../../src/interfaces/query/condition-tree/nodes/leaf';
import DataSourceDecorator from '../../../src/decorators/datasource-decorator';
import ValidationError from '../../../src/errors';
import WriteDecorator from '../../../src/decorators/write/collection';

describe('WriteDecorator', () => {
  const setValue = jest.fn().mockImplementation();

  const setupWithDecoratedBookCollectionAsReadOnly = () => {
    const collection = factories.collection.build({
      name: 'book',
      schema: factories.collectionSchema.build({
        fields: {
          name: factories.columnSchema.build({
            isReadOnly: true,
          }),
          age: factories.columnSchema.build({
            isReadOnly: true,
          }),
          price: factories.columnSchema.build({
            isReadOnly: true,
          }),
        },
      }),
    });
    const dataSource = factories.dataSource.buildWithCollection(collection);

    return { collection, dataSource };
  };

  it('should set as false a isReadOnly schema attribute', () => {
    const { collection, dataSource } = setupWithDecoratedBookCollectionAsReadOnly();

    const decoratedCollection = new WriteDecorator(collection, dataSource);
    decoratedCollection.implement('name', setValue);

    const name = decoratedCollection.schema.fields.name as ColumnSchema;
    expect(name.isReadOnly).toEqual(false);
  });

  it('should throw an error when the registered name does not exist', () => {
    const { collection, dataSource } = setupWithDecoratedBookCollectionAsReadOnly();

    const decoratedCollection = new WriteDecorator(collection, dataSource);

    expect(() => decoratedCollection.implement('NOT EXIST', setValue)).toThrowError(
      'The given field NOT EXIST does not exist on the book collection.',
    );
  });

  describe('setValue(): void', () => {
    it('should trigger the setValue function to update it', async () => {
      const { collection, dataSource } = setupWithDecoratedBookCollectionAsReadOnly();

      const decoratedCollection = new WriteDecorator(collection, dataSource);
      decoratedCollection.implement('name', setValue);

      await decoratedCollection.update(factories.filter.build(), { name: 'orius' });

      expect(setValue).toHaveBeenCalledWith('orius', {
        dataSource,
        action: 'update',
        record: { name: 'orius' },
      });
    });

    it('updates child collection without the triggered setValue column', async () => {
      const { collection, dataSource } = setupWithDecoratedBookCollectionAsReadOnly();

      const decoratedCollection = new WriteDecorator(collection, dataSource);
      decoratedCollection.implement('name', setValue);

      await decoratedCollection.update(factories.filter.build(), {
        name: 'jean',
        otherColumn: 'aValue',
      });

      expect(collection.update).toHaveBeenCalledWith(expect.any(PaginatedFilter), {
        otherColumn: 'aValue',
      });
    });

    describe('when many columns have the setValue defined', () => {
      it('should trigger all the setValue function to update it', async () => {
        const { collection, dataSource } = setupWithDecoratedBookCollectionAsReadOnly();

        const decoratedCollection = new WriteDecorator(collection, dataSource);
        const nameSetValue = jest.fn();
        decoratedCollection.implement('name', nameSetValue);
        const ageSetValue = jest.fn();
        decoratedCollection.implement('age', ageSetValue);

        await decoratedCollection.update(factories.filter.build(), { name: 'orius', age: '10' });

        expect(nameSetValue).toHaveBeenCalledWith('orius', {
          dataSource,
          action: 'update',
          record: { name: 'orius', age: '10' },
        });
        expect(ageSetValue).toHaveBeenCalledWith('10', {
          dataSource,
          action: 'update',
          record: { name: 'orius', age: '10' },
        });
      });

      it('the given record in the context of the setValue should be a copy', async () => {
        const { collection, dataSource } = setupWithDecoratedBookCollectionAsReadOnly();
        const decoratedCollection = new WriteDecorator(collection, dataSource);

        const nameSetValue = jest.fn().mockImplementation((patch, context) => {
          context.record.ADDED_FIELD = 'IS A COPY';
        });
        decoratedCollection.implement('name', nameSetValue);

        const ageSetValue = jest.fn();
        decoratedCollection.implement('age', ageSetValue);

        await decoratedCollection.update(factories.filter.build(), { name: 'orius', age: '10' });

        expect(nameSetValue).toHaveBeenCalledWith(
          'orius',
          expect.objectContaining({
            record: { name: 'orius', age: '10', ADDED_FIELD: 'IS A COPY' },
          }),
        );
        expect(ageSetValue).toHaveBeenCalledWith(
          '10',
          expect.objectContaining({
            record: { name: 'orius', age: '10' }, // ADDED_FIELD should not be hear
          }),
        );
      });

      it('updates child collection without the columns where the setValue is defined', async () => {
        const { collection, dataSource } = setupWithDecoratedBookCollectionAsReadOnly();

        const decoratedCollection = new WriteDecorator(collection, dataSource);
        const nameSetValue = jest.fn();
        decoratedCollection.implement('name', nameSetValue);
        const ageSetValue = jest.fn();
        decoratedCollection.implement('age', ageSetValue);

        await decoratedCollection.update(factories.filter.build(), {
          name: 'orius',
          age: '10',
        });

        expect(collection.update).toHaveBeenCalledWith(expect.any(PaginatedFilter), {});
      });
    });
  });

  describe('setValue(): patch', () => {
    const setupWithManyToOneRelation = () => {
      const prices = factories.collection.build({
        name: 'prices',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build(),
            value: factories.columnSchema.build({ columnType: PrimitiveTypes.Number }),
          },
        }),
      });

      const persons = factories.collection.build({
        name: 'persons',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build(),
            name: factories.columnSchema.build({ columnType: PrimitiveTypes.String }),
            priceId: factories.columnSchema.build({ columnType: PrimitiveTypes.Uuid }),
            myPrice: factories.manyToOneSchema.build({
              foreignCollection: 'prices',
              foreignKey: 'priceId',
            }),
          },
        }),
      });

      const books = factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build(),
            authorId: factories.columnSchema.build({ columnType: PrimitiveTypes.Uuid }),
            title: factories.columnSchema.build({ columnType: PrimitiveTypes.String }),
            myAuthor: factories.manyToOneSchema.build({
              foreignCollection: 'persons',
              foreignKey: 'authorId',
            }),
          },
        }),
      });
      const dataSource = factories.dataSource.buildWithCollections([persons, books, prices]);

      return { dataSource, collection: dataSource.getCollection('books') };
    };

    const setupWithOneToOneRelation = () => {
      const dataSource = factories.dataSource.buildWithCollections([
        factories.collection.build({
          name: 'books',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.isPrimaryKey().build(),
              myOwner: factories.oneToOneSchema.build({
                foreignCollection: 'owners',
                foreignKey: 'bookId',
              }),
              title: factories.columnSchema.build(),
            },
          }),
        }),
        factories.collection.build({
          name: 'owners',
          schema: factories.collectionSchema.build({
            fields: {
              id: factories.columnSchema.isPrimaryKey().build(),
              bookId: factories.columnSchema.build({ columnType: PrimitiveTypes.Uuid }),
              name: factories.columnSchema.build({ columnType: PrimitiveTypes.String }),
            },
          }),
        }),
      ]);

      return { dataSource, collection: dataSource.getCollection('books') };
    };

    describe('update', () => {
      it('should provide a setValue method with a patch and a context', async () => {
        const { collection, dataSource } = setupWithDecoratedBookCollectionAsReadOnly();
        collection.update = jest.fn().mockResolvedValue({ name: 'a name' });

        const decoratedCollection = new WriteDecorator(collection, dataSource);
        decoratedCollection.implement('name', setValue);
        await decoratedCollection.update(new Filter({}), { name: 'a name' });

        expect(setValue).toHaveBeenCalledWith('a name', {
          dataSource,
          action: 'update',
          record: { name: 'a name' },
        });
      });

      it('updates child collection with the result of the setValue', async () => {
        const { collection, dataSource } = setupWithDecoratedBookCollectionAsReadOnly();

        const decoratedCollection = new WriteDecorator(collection, dataSource);

        const nameSetValue = jest.fn().mockResolvedValue({ name: 'changed name' });
        decoratedCollection.implement('name', nameSetValue);

        await decoratedCollection.update(factories.filter.build(), {
          name: 'orius',
          otherColumn: 'a value',
        });

        expect(collection.update).toHaveBeenCalledWith(expect.any(PaginatedFilter), {
          name: 'changed name',
          otherColumn: 'a value',
        });
      });

      describe('when the setValue does not return a valid record', () => {
        it('should throw an error', async () => {
          const { collection, dataSource } = setupWithDecoratedBookCollectionAsReadOnly();

          const decoratedCollection = new WriteDecorator(collection, dataSource);
          const ageSetValue = jest.fn().mockResolvedValue('RETURN_SHOULD_FAIL');
          decoratedCollection.implement('age', ageSetValue);

          await expect(() =>
            decoratedCollection.update(factories.filter.build(), {
              age: '10',
            }),
          ).rejects.toThrowError('The write handler of age should return an object or nothing.');
        });
      });

      describe('when the setValue returns a relation value', () => {
        describe('when it returns a unknown relation', () => {
          it('should throw an error', async () => {
            const { collection, dataSource } = setupWithDecoratedBookCollectionAsReadOnly();

            const decoratedCollection = new WriteDecorator(collection, dataSource);
            const ageSetValue = jest.fn().mockResolvedValue({ book: { title: 'A title' } });
            decoratedCollection.implement('age', ageSetValue);

            await expect(() =>
              decoratedCollection.update(factories.filter.build(), {
                age: '10',
              }),
            ).rejects.toThrowError('Unknown field "book"');
          });
        });

        describe('with many to one relation', () => {
          it('updates the right relation collection with the right params', async () => {
            // given
            const { collection, dataSource } = setupWithManyToOneRelation();

            const decoratedCollection = new WriteDecorator(collection, dataSource);
            const titleSetValue = jest
              .fn()
              .mockResolvedValue({ myAuthor: { name: 'NAME TO CHANGE' } });
            decoratedCollection.implement('title', titleSetValue);

            const personsCollection = dataSource.getCollection('persons');
            collection.list = jest
              .fn()
              .mockResolvedValue([
                { authorId: '123e4567-e89b-12d3-a456-111111111111' },
                { authorId: '123e4567-e89b-12d3-a456-222222222222' },
              ]);

            // when
            const conditionTree = factories.conditionTreeLeaf.build();
            await decoratedCollection.update(factories.filter.build({ conditionTree }), {
              title: 'a title',
            });

            // then
            expect(collection.list).toHaveBeenCalledWith(new PaginatedFilter({ conditionTree }), [
              'authorId',
            ]);
            expect(collection.update).toHaveBeenCalledWith(
              new PaginatedFilter({ conditionTree }),
              {},
            );
            expect(personsCollection.update).toHaveBeenCalledWith(
              new Filter({
                conditionTree: factories.conditionTreeLeaf.build({
                  operator: Operator.In,
                  value: [
                    '123e4567-e89b-12d3-a456-111111111111',
                    '123e4567-e89b-12d3-a456-222222222222',
                  ],
                  field: 'id',
                }),
              }),
              {
                name: 'NAME TO CHANGE',
              },
            );
          });

          it('updates a 2 degree relation', async () => {
            // given
            const { collection, dataSource } = setupWithManyToOneRelation();

            const decoratedDatasource = new DataSourceDecorator(dataSource, WriteDecorator);

            const pricesCollection = decoratedDatasource.getCollection('prices');
            pricesCollection.update = jest.fn();

            const decoratedCollection = decoratedDatasource.getCollection('books');
            const titleSetValue = jest
              .fn()
              .mockResolvedValue({ myAuthor: { myPrice: { value: 10 } } });
            decoratedCollection.implement('title', titleSetValue);

            decoratedCollection.list = jest
              .fn()
              .mockResolvedValue([{ authorId: '123e4567-e89b-12d3-a456-111111111111' }]);

            const personsCollection = decoratedDatasource.getCollection('persons');
            personsCollection.list = jest
              .fn()
              .mockResolvedValue([{ priceId: '123e4567-e89b-12d3-a456-333333333333' }]);

            // when
            const conditionTree = factories.conditionTreeLeaf.build();
            await decoratedCollection.update(factories.filter.build({ conditionTree }), {
              title: 'a title',
            });

            // then
            expect(decoratedCollection.list).toHaveBeenCalledWith(
              new PaginatedFilter({ conditionTree }),
              ['authorId'],
            );
            expect(personsCollection.list).toHaveBeenCalledWith(
              new Filter({
                conditionTree: factories.conditionTreeLeaf.build({
                  field: 'id',
                  value: ['123e4567-e89b-12d3-a456-111111111111'],
                  operator: Operator.In,
                }),
              }),
              ['priceId'],
            );

            expect(collection.update).toHaveBeenCalledWith(
              new PaginatedFilter({ conditionTree }),
              {},
            );
            expect(pricesCollection.update).toHaveBeenCalledWith(
              new Filter({
                conditionTree: factories.conditionTreeLeaf.build({
                  operator: Operator.In,
                  value: ['123e4567-e89b-12d3-a456-333333333333'],
                  field: 'id',
                }),
              }),
              {
                value: 10,
              },
            );
          });
        });

        describe('with one to one relation', () => {
          it('updates the right relation collection with the right params', async () => {
            const { collection, dataSource } = setupWithOneToOneRelation();

            // given
            const decoratedCollection = new WriteDecorator(collection, dataSource);
            const titleSetValue = jest
              .fn()
              .mockResolvedValue({ myOwner: { name: 'NAME TO CHANGE' } });
            decoratedCollection.implement('title', titleSetValue);
            collection.list = jest
              .fn()
              .mockResolvedValue([{ id: '123e4567-e89b-12d3-a456-111111111111' }]);

            // when
            const conditionTree = factories.conditionTreeLeaf.build({
              operator: Operator.Equal,
              value: 'a name',
              field: 'name',
            });
            await decoratedCollection.update(factories.filter.build({ conditionTree }), {
              title: 'a title',
            });

            // then
            expect(collection.list).toHaveBeenCalledWith(new PaginatedFilter({ conditionTree }), [
              'id',
            ]);

            const ownersCollection = dataSource.getCollection('owners');
            const conditionTreeBookId = factories.conditionTreeLeaf.build({
              operator: Operator.In,
              value: ['123e4567-e89b-12d3-a456-111111111111'],
              field: 'bookId',
            });
            expect(collection.update).toHaveBeenCalledWith(
              new PaginatedFilter({ conditionTree }),
              {},
            );
            expect(ownersCollection.update).toHaveBeenCalledWith(
              new Filter({ conditionTree: conditionTreeBookId }),
              {
                name: 'NAME TO CHANGE',
              },
            );
          });
        });

        describe('when many columns have defined setValue', () => {
          it('updates child collection with the setValue results', async () => {
            const { collection, dataSource } = setupWithDecoratedBookCollectionAsReadOnly();

            const decoratedCollection = new WriteDecorator(collection, dataSource);
            const nameSetValue = jest.fn().mockResolvedValue({ name: 'changed name' });
            decoratedCollection.implement('name', nameSetValue);
            const ageSetValue = jest.fn().mockResolvedValue({ age: 'changedAge' });
            decoratedCollection.implement('age', ageSetValue);

            await decoratedCollection.update(factories.filter.build(), {
              name: 'orius',
              age: '10',
            });

            expect(collection.update).toHaveBeenCalledWith(expect.any(PaginatedFilter), {
              name: 'changed name',
              age: 'changedAge',
            });
          });
        });

        describe('when the setValue returns a column value with a defined setValue', () => {
          it('should trigger the targeted setValue', async () => {
            const { collection, dataSource } = setupWithDecoratedBookCollectionAsReadOnly();

            const decoratedCollection = new WriteDecorator(collection, dataSource);
            const nameSetValue = jest.fn().mockResolvedValue({ name: 'triggeredChangedName' });
            decoratedCollection.implement('name', nameSetValue);
            const ageSetValueTriggerName = jest.fn().mockResolvedValue({ name: 'changed name' });
            decoratedCollection.implement('age', ageSetValueTriggerName);

            await decoratedCollection.update(factories.filter.build(), { age: '10' });

            expect(collection.update).toHaveBeenCalledWith(expect.any(PaginatedFilter), {
              name: 'triggeredChangedName',
            });
          });

          it('should trigger as long as there is setValue targeted', async () => {
            const { collection, dataSource } = setupWithDecoratedBookCollectionAsReadOnly();

            const decoratedCollection = new WriteDecorator(collection, dataSource);
            const priceSetValue = jest.fn().mockResolvedValue({ price: 'triggeredChangedPrice' });
            decoratedCollection.implement('price', priceSetValue);
            const nameSetValue = jest.fn().mockResolvedValue({ price: 'triggeredChangedName' });
            decoratedCollection.implement('name', nameSetValue);
            const ageSetValueTriggerName = jest.fn().mockResolvedValue({ name: 'changed name' });
            decoratedCollection.implement('age', ageSetValueTriggerName);

            await decoratedCollection.update(factories.filter.build(), { age: '10' });

            expect(collection.update).toHaveBeenCalledWith(expect.any(PaginatedFilter), {
              price: 'triggeredChangedPrice',
            });
          });

          it('should throw an error if the same setValue is triggered several times', async () => {
            const { collection, dataSource } = setupWithDecoratedBookCollectionAsReadOnly();

            const decoratedCollection = new WriteDecorator(collection, dataSource);
            const nameSetValue = jest.fn().mockResolvedValue({ name: 'triggeredSecondTime' });
            decoratedCollection.implement('name', nameSetValue);
            const ageSetValueTriggerName = jest.fn().mockResolvedValue({ name: 'changed name' });
            decoratedCollection.implement('age', ageSetValueTriggerName);

            await expect(() =>
              decoratedCollection.update(factories.filter.build(), {
                age: '10',
                name: 'triggeredOneTime',
              }),
            ).rejects.toThrow(
              new ValidationError(
                'Conflict value on the column "name". It receives several values.',
              ),
            );
          });

          it('should throw an error if there is a cyclic dependency', async () => {
            const { collection, dataSource } = setupWithDecoratedBookCollectionAsReadOnly();

            const decoratedCollection = new WriteDecorator(collection, dataSource);
            const nameSetValue = jest.fn().mockResolvedValue({ age: 'cyclic dependency' });
            decoratedCollection.implement('name', nameSetValue);
            const ageSetValueTriggerName = jest.fn().mockResolvedValue({ name: 'changed name' });
            decoratedCollection.implement('age', ageSetValueTriggerName);

            await expect(() =>
              decoratedCollection.update(factories.filter.build(), {
                age: '10',
              }),
            ).rejects.toThrow(
              new ValidationError('There is a cyclic dependency on the "age" column.'),
            );
          });
        });
      });
    });

    describe('create ', () => {
      it('should provide a setValue method with a patch and a context', async () => {
        const { collection, dataSource } = setupWithDecoratedBookCollectionAsReadOnly();
        collection.create = jest.fn().mockResolvedValue([{ name: 'a name' }]);

        const decoratedCollection = new WriteDecorator(collection, dataSource);
        decoratedCollection.implement('name', setValue);
        await decoratedCollection.create([{ name: 'a name' }]);

        expect(setValue).toHaveBeenCalledWith('a name', {
          dataSource,
          action: 'create',
          record: { name: 'a name' },
        });
      });

      it('calls create on child collection with the result of the setValue', async () => {
        const { collection, dataSource } = setupWithDecoratedBookCollectionAsReadOnly();

        const decoratedCollection = new WriteDecorator(collection, dataSource);

        const nameSetValue = jest.fn().mockResolvedValue({ name: 'changed name' });
        decoratedCollection.implement('name', nameSetValue);
        collection.create = jest.fn().mockResolvedValue([
          {
            name: 'changed name',
            otherColumn: 'other value',
          },
        ]);

        await decoratedCollection.create([
          { name: 'orius', otherColumn: 'other value' },
          { name: 'orius', otherColumn: 'other value' },
        ]);

        expect(collection.create).toHaveBeenNthCalledWith(1, [
          {
            name: 'changed name',
            otherColumn: 'other value',
          },
        ]);
        expect(collection.create).toHaveBeenNthCalledWith(2, [
          {
            name: 'changed name',
            otherColumn: 'other value',
          },
        ]);
      });

      describe('with one to one relation', () => {
        describe('when the relation does not exist', () => {
          it('creates the relation and attaches to the new collection', async () => {
            const { collection, dataSource } = setupWithOneToOneRelation();
            const ownersCollection = dataSource.getCollection('owners');

            // given
            const decoratedCollection = new WriteDecorator(collection, dataSource);
            const titleSetValue = jest
              .fn()
              .mockResolvedValue({ myOwner: { name: 'NAME TO CHANGE' }, title: 'name' });
            decoratedCollection.implement('title', titleSetValue);
            collection.create = jest
              .fn()
              .mockResolvedValue([
                { id: '123e4567-e89b-12d3-a456-111111111111', notImportantColumn: 'foo' },
              ]);

            // when
            await decoratedCollection.create([{ title: 'a title' }]);

            expect(ownersCollection.create).toHaveBeenCalledWith([
              { name: 'NAME TO CHANGE', bookId: '123e4567-e89b-12d3-a456-111111111111' },
            ]);
            expect(collection.create).toHaveBeenCalledWith([{ title: 'name' }]);
          });

          describe('when the setValue returns several relations', () => {
            const setupWithTwoOneToOneRelations = () => {
              const dataSource = factories.dataSource.buildWithCollections([
                factories.collection.build({
                  name: 'books',
                  schema: factories.collectionSchema.build({
                    fields: {
                      id: factories.columnSchema.isPrimaryKey().build(),
                      myOwner: factories.oneToOneSchema.build({
                        foreignCollection: 'owners',
                        foreignKey: 'bookId',
                      }),
                      myFormat: factories.oneToOneSchema.build({
                        foreignCollection: 'formats',
                        foreignKey: 'bookId',
                      }),
                      title: factories.columnSchema.build(),
                    },
                  }),
                }),
                factories.collection.build({
                  name: 'owners',
                  schema: factories.collectionSchema.build({
                    fields: {
                      id: factories.columnSchema.isPrimaryKey().build(),
                      bookId: factories.columnSchema.build({ columnType: PrimitiveTypes.Uuid }),
                      name: factories.columnSchema.build({ columnType: PrimitiveTypes.String }),
                    },
                  }),
                }),
                factories.collection.build({
                  name: 'formats',
                  schema: factories.collectionSchema.build({
                    fields: {
                      id: factories.columnSchema.isPrimaryKey().build(),
                      bookId: factories.columnSchema.build({ columnType: PrimitiveTypes.Uuid }),
                      name: factories.columnSchema.build({ columnType: PrimitiveTypes.String }),
                    },
                  }),
                }),
              ]);

              return { dataSource, collection: dataSource.getCollection('books') };
            };

            it('creates the relations and attaches to the new collection', async () => {
              const { collection, dataSource } = setupWithTwoOneToOneRelations();
              const ownersCollection = dataSource.getCollection('owners');
              const formatsCollection = dataSource.getCollection('formats');

              // given
              const decoratedCollection = new WriteDecorator(collection, dataSource);
              const titleSetValue = jest.fn().mockResolvedValue({
                myOwner: { name: 'Orius' },
                myFormat: { name: 'XXL' },
                title: 'name',
              });
              decoratedCollection.implement('title', titleSetValue);
              collection.create = jest
                .fn()
                .mockResolvedValue([
                  { id: '123e4567-e89b-12d3-a456-111111111111', notImportantColumn: 'foo' },
                ]);

              // when
              await decoratedCollection.create([{ title: 'a title' }]);

              expect(ownersCollection.create).toHaveBeenCalledWith([
                { name: 'Orius', bookId: '123e4567-e89b-12d3-a456-111111111111' },
              ]);
              expect(formatsCollection.create).toHaveBeenCalledWith([
                { name: 'XXL', bookId: '123e4567-e89b-12d3-a456-111111111111' },
              ]);
              expect(collection.create).toHaveBeenCalledTimes(1);
              expect(collection.create).toHaveBeenCalledWith([{ title: 'name' }]);
            });
          });
        });

        describe('when the foreign key is given', () => {
          it('updates the relation and attaches to the new collection', async () => {
            const { collection, dataSource } = setupWithOneToOneRelation();
            const ownersCollection = dataSource.getCollection('owners');

            // given
            const decoratedCollection = new WriteDecorator(collection, dataSource);
            const titleSetValue = jest
              .fn()
              .mockResolvedValue({ myOwner: { name: 'NAME TO CHANGE' }, title: 'name' });
            decoratedCollection.implement('title', titleSetValue);
            collection.create = jest.fn().mockResolvedValue([{ title: 'name' }]);

            // when
            await decoratedCollection.create([
              { title: 'a title', bookId: '123e4567-e89b-12d3-a456-111111111111' },
            ]);
            expect(collection.create).toHaveBeenCalledWith([{ title: 'name' }]);
            expect(ownersCollection.update).toHaveBeenCalledWith(
              new Filter({
                conditionTree: factories.conditionTreeLeaf.build({
                  operator: Operator.Equal,
                  value: '123e4567-e89b-12d3-a456-111111111111',
                  field: 'bookId',
                }),
              }),
              { name: 'NAME TO CHANGE' },
            );
          });
        });
      });

      describe('with many to one relation', () => {
        describe('when the relation does not exist', () => {
          it('creates the relation and attaches to the new collection', async () => {
            const { collection, dataSource } = setupWithManyToOneRelation();

            const decoratedCollection = new WriteDecorator(collection, dataSource);
            const titleSetValue = jest
              .fn()
              .mockResolvedValue({ myAuthor: { name: 'NAME TO CHANGE' } });
            decoratedCollection.implement('title', titleSetValue);

            const personsCollection = dataSource.getCollection('persons');
            personsCollection.create = jest
              .fn()
              .mockResolvedValue([
                { id: '123e4567-e89b-12d3-a456-111111111111', name: 'NAME TO CHANGE' },
              ]);
            collection.create = jest.fn().mockResolvedValue([{ title: 'name' }]);

            // when
            await decoratedCollection.create([{ title: 'a title' }]);

            // then
            expect(collection.create).toHaveBeenCalledWith([
              { authorId: '123e4567-e89b-12d3-a456-111111111111' },
            ]);
            expect(personsCollection.create).toHaveBeenCalledWith([{ name: 'NAME TO CHANGE' }]);
          });

          describe('when the setValue returns several relations', () => {
            const setupWithTwoManyToOneRelations = () => {
              const formats = factories.collection.build({
                name: 'formats',
                schema: factories.collectionSchema.build({
                  fields: {
                    id: factories.columnSchema.isPrimaryKey().build(),
                    name: factories.columnSchema.build({ columnType: PrimitiveTypes.String }),
                  },
                }),
              });

              const authors = factories.collection.build({
                name: 'authors',
                schema: factories.collectionSchema.build({
                  fields: {
                    id: factories.columnSchema.isPrimaryKey().build(),
                    name: factories.columnSchema.build({ columnType: PrimitiveTypes.String }),
                    priceId: factories.columnSchema.build({ columnType: PrimitiveTypes.Uuid }),
                  },
                }),
              });

              const books = factories.collection.build({
                name: 'books',
                schema: factories.collectionSchema.build({
                  fields: {
                    id: factories.columnSchema.isPrimaryKey().build(),
                    title: factories.columnSchema.build({ columnType: PrimitiveTypes.String }),
                    authorId: factories.columnSchema.build({ columnType: PrimitiveTypes.Uuid }),
                    myAuthor: factories.manyToOneSchema.build({
                      foreignCollection: 'authors',
                      foreignKey: 'authorId',
                    }),
                    formatId: factories.columnSchema.build({ columnType: PrimitiveTypes.Uuid }),
                    myFormat: factories.manyToOneSchema.build({
                      foreignCollection: 'formats',
                      foreignKey: 'formatId',
                    }),
                  },
                }),
              });
              const dataSource = factories.dataSource.buildWithCollections([
                authors,
                books,
                formats,
              ]);

              return { dataSource, collection: dataSource.getCollection('books') };
            };

            it('creates the relations and attaches to the new collection', async () => {
              const { collection, dataSource } = setupWithTwoManyToOneRelations();
              const authorsCollection = dataSource.getCollection('authors');
              const formatsCollection = dataSource.getCollection('formats');

              const decoratedCollection = new WriteDecorator(collection, dataSource);
              const titleSetValue = jest.fn().mockResolvedValue({
                myAuthor: { name: 'Orius' },
                myFormat: { name: 'XXL' },
                title: 'name',
              });
              decoratedCollection.implement('title', titleSetValue);

              authorsCollection.create = jest
                .fn()
                .mockResolvedValue([{ id: '123e4567-e89b-12d3-a456-111111111111', name: 'Orius' }]);
              formatsCollection.create = jest
                .fn()
                .mockResolvedValue([{ id: '123e4567-e89b-12d3-a456-222222222222', name: 'XXL' }]);
              collection.create = jest.fn().mockResolvedValue([{ title: 'name' }]);

              // when
              await decoratedCollection.create([{ title: 'a title' }]);

              // then
              expect(authorsCollection.create).toHaveBeenCalledWith([{ name: 'Orius' }]);
              expect(formatsCollection.create).toHaveBeenCalledWith([{ name: 'XXL' }]);

              expect(collection.create).toHaveBeenCalledWith([
                {
                  title: 'name',
                  formatId: '123e4567-e89b-12d3-a456-222222222222',
                  authorId: '123e4567-e89b-12d3-a456-111111111111',
                },
              ]);
            });
          });
        });

        describe('when the foreign key is given', () => {
          it('updates the relation and attaches to the new collection', async () => {
            const { collection, dataSource } = setupWithManyToOneRelation();

            const decoratedCollection = new WriteDecorator(collection, dataSource);
            const titleSetValue = jest
              .fn()
              .mockResolvedValue({ myAuthor: { name: 'NAME TO CHANGE' } });
            decoratedCollection.implement('title', titleSetValue);

            const personsCollection = dataSource.getCollection('persons');
            personsCollection.create = jest
              .fn()
              .mockResolvedValue([
                { id: '123e4567-e89b-12d3-a456-111111111111', name: 'NAME TO CHANGE' },
              ]);
            collection.create = jest.fn().mockResolvedValue([{ title: 'name' }]);

            // when
            await decoratedCollection.create([
              { title: 'a title', authorId: '123e4567-e89b-12d3-a456-111111111111' },
            ]);

            // then
            expect(collection.create).toHaveBeenCalledWith([
              { authorId: '123e4567-e89b-12d3-a456-111111111111' },
            ]);
            expect(personsCollection.update).toHaveBeenCalledWith(
              new Filter({
                conditionTree: factories.conditionTreeLeaf.build({
                  operator: Operator.Equal,
                  value: '123e4567-e89b-12d3-a456-111111111111',
                  field: 'id',
                }),
              }),
              {
                name: 'NAME TO CHANGE',
              },
            );
          });
        });
      });

      describe('with many to one and one to one relations', () => {
        const setupWithManyToOneAndOneToOneRelation = () => {
          const dataSource = factories.dataSource.buildWithCollections([
            factories.collection.build({
              name: 'books',
              schema: factories.collectionSchema.build({
                fields: {
                  id: factories.columnSchema.isPrimaryKey().build(),
                  myAuthor: factories.oneToOneSchema.build({
                    foreignCollection: 'authors',
                    foreignKey: 'bookId',
                  }),
                  formatId: factories.columnSchema.build({ columnType: PrimitiveTypes.Uuid }),
                  myFormat: factories.manyToOneSchema.build({
                    foreignCollection: 'formats',
                    foreignKey: 'formatId',
                  }),
                  title: factories.columnSchema.build(),
                },
              }),
            }),
            factories.collection.build({
              name: 'authors',
              schema: factories.collectionSchema.build({
                fields: {
                  id: factories.columnSchema.isPrimaryKey().build(),
                  bookId: factories.columnSchema.build({ columnType: PrimitiveTypes.Uuid }),
                  name: factories.columnSchema.build({ columnType: PrimitiveTypes.String }),
                },
              }),
            }),
            factories.collection.build({
              name: 'formats',
              schema: factories.collectionSchema.build({
                fields: {
                  id: factories.columnSchema.isPrimaryKey().build(),
                  name: factories.columnSchema.build({ columnType: PrimitiveTypes.String }),
                },
              }),
            }),
          ]);

          return { dataSource, collection: dataSource.getCollection('books') };
        };

        it('creates the relations and attaches to the new collection', async () => {
          const { collection, dataSource } = setupWithManyToOneAndOneToOneRelation();
          const authorsCollection = dataSource.getCollection('authors');
          const formatsCollection = dataSource.getCollection('formats');

          const decoratedCollection = new WriteDecorator(collection, dataSource);
          const titleSetValue = jest.fn().mockResolvedValue({
            myAuthor: { name: 'Orius' },
            myFormat: { name: 'XXL' },
            title: 'a name',
          });
          decoratedCollection.implement('title', titleSetValue);

          collection.create = jest
            .fn()
            .mockResolvedValue([{ id: '123e4567-e89b-12d3-a456-426614174087', title: 'a name' }]);
          authorsCollection.create = jest
            .fn()
            .mockResolvedValue([{ id: '123e4567-e89b-12d3-a456-111111111111', name: 'Orius' }]);
          formatsCollection.create = jest
            .fn()
            .mockResolvedValue([{ id: '123e4567-e89b-12d3-a456-222222222222', name: 'XXL' }]);

          // when
          await decoratedCollection.create([{ title: 'a title' }]);

          // then
          expect(collection.create).toHaveBeenCalledTimes(1);
          expect(collection.create).toHaveBeenCalledWith([
            { formatId: '123e4567-e89b-12d3-a456-222222222222', title: 'a name' },
          ]);
          expect(authorsCollection.create).toHaveBeenCalledWith([
            { bookId: '123e4567-e89b-12d3-a456-426614174087', name: 'Orius' },
          ]);
          expect(formatsCollection.create).toHaveBeenCalledWith([{ name: 'XXL' }]);
        });
      });
    });
  });
});
