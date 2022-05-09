import * as factories from '../../__factories__';
import { ColumnSchema } from '../../../src/interfaces/schema';
import { Filter, PaginatedFilter } from '../../../src';
import DataSourceDecorator from '../../../src/decorators/datasource-decorator';
import ValidationError from '../../../src/errors';
import WriteDecorator from '../../../src/decorators/write/collection';

describe('WriteDecorator', () => {
  describe('when the field has an handler', () => {
    describe('when it is updated', () => {
      it('should provide a handler definition with a patch and a context', async () => {
        // given
        const dataSource = factories.dataSource.buildWithCollection(
          factories.collection.build({
            name: 'books',
            schema: factories.collectionSchema.build({
              fields: {
                name: factories.columnSchema.build({ columnType: 'String' }),
              },
            }),
          }),
        );
        const collection = dataSource.getCollection('books');
        collection.update = jest.fn().mockResolvedValue({ name: 'a name' });

        const decoratedCollection = new WriteDecorator(collection, dataSource);
        const handler = jest.fn().mockImplementation();
        decoratedCollection.replaceFieldWriting('name', handler);

        // when
        await decoratedCollection.update(factories.caller.build(), new Filter({}), {
          name: 'a name',
        });

        // then
        expect(handler).toHaveBeenCalledWith(
          'a name',
          expect.objectContaining({
            action: 'update',
            record: { name: 'a name' },
          }),
        );
      });
    });

    describe('when it is created', () => {
      it('should provide a handler definition with a patch and a context', async () => {
        // given
        const dataSource = factories.dataSource.buildWithCollection(
          factories.collection.build({
            name: 'books',
            schema: factories.collectionSchema.build({
              fields: {
                name: factories.columnSchema.build({ columnType: 'String' }),
              },
            }),
          }),
        );
        const collection = dataSource.getCollection('books');
        collection.create = jest.fn().mockResolvedValue([{ name: 'a name' }]);

        const decoratedCollection = new WriteDecorator(collection, dataSource);
        const handler = jest.fn().mockImplementation();
        decoratedCollection.replaceFieldWriting('name', handler);

        // when
        await decoratedCollection.create(factories.caller.build(), [{ name: 'a name' }]);

        // then
        expect(handler).toHaveBeenCalledWith(
          'a name',
          expect.objectContaining({
            action: 'create',
            record: { name: 'a name' },
          }),
        );
      });
    });
  });

  describe('when there is a read only field', () => {
    it('should set as false a isReadOnly schema attribute', () => {
      // given
      const dataSource = factories.dataSource.buildWithCollection(
        factories.collection.build({
          name: 'books',
          schema: factories.collectionSchema.build({
            fields: {
              name: factories.columnSchema.build({
                isReadOnly: true,
              }),
            },
          }),
        }),
      );
      const collection = dataSource.getCollection('books');

      // when
      const handler = jest.fn().mockImplementation();
      const decoratedCollection = new WriteDecorator(collection, dataSource);
      decoratedCollection.replaceFieldWriting('name', handler);

      // then
      const name = decoratedCollection.schema.fields.name as ColumnSchema;
      expect(name.isReadOnly).toEqual(false);
    });
  });

  it('should throw an error when the registered name does not exist', () => {
    const decoratedCollection = new WriteDecorator(
      factories.collection.build({ name: 'books' }),
      factories.dataSource.build(),
    );
    const handler = jest.fn().mockImplementation();

    expect(() => decoratedCollection.replaceFieldWriting('NOT EXIST', handler)).toThrowError(
      'The given field "NOT EXIST" does not exist on the books collection.',
    );
  });

  describe('when handler returns nothing', () => {
    it('should trigger the definition function to update it', async () => {
      // given
      const dataSource = factories.dataSource.buildWithCollection(
        factories.collection.build({
          name: 'books',
          schema: factories.collectionSchema.build({
            fields: {
              name: factories.columnSchema.build({ columnType: 'String' }),
            },
          }),
        }),
      );
      const collection = dataSource.getCollection('books');

      const decoratedCollection = new WriteDecorator(collection, dataSource);
      const handler = jest.fn().mockImplementation();
      decoratedCollection.replaceFieldWriting('name', handler);

      // when
      await decoratedCollection.update(factories.caller.build(), factories.filter.build(), {
        name: 'orius',
      });

      // then
      expect(handler).toHaveBeenCalledWith(
        'orius',
        expect.objectContaining({ action: 'update', record: { name: 'orius' } }),
      );
    });

    it('updates child collection without the triggered definition field', async () => {
      // given
      const dataSource = factories.dataSource.buildWithCollection(
        factories.collection.build({
          name: 'books',
          schema: factories.collectionSchema.build({
            fields: {
              name: factories.columnSchema.build({ columnType: 'String' }),
            },
          }),
        }),
      );
      const collection = dataSource.getCollection('books');
      const decoratedCollection = new WriteDecorator(collection, dataSource);
      const handler = jest.fn().mockImplementation();
      decoratedCollection.replaceFieldWriting('name', handler);

      // when
      const caller = factories.caller.build();
      const filter = factories.filter.build();
      await decoratedCollection.update(caller, filter, { name: 'jean', otherField: 'aValue' });

      // then
      expect(collection.update).toHaveBeenCalledWith(caller, filter, { otherField: 'aValue' });
    });

    describe('when many fields have a definition', () => {
      it('should trigger all the definition function to update it', async () => {
        // given
        const dataSource = factories.dataSource.buildWithCollection(
          factories.collection.build({
            name: 'books',
            schema: factories.collectionSchema.build({
              fields: {
                name: factories.columnSchema.build({ columnType: 'String' }),
                age: factories.columnSchema.build({ columnType: 'String' }),
              },
            }),
          }),
        );
        const collection = dataSource.getCollection('books');

        const decoratedCollection = new WriteDecorator(collection, dataSource);
        const nameDefinition = jest.fn();
        decoratedCollection.replaceFieldWriting('name', nameDefinition);
        const ageDefinition = jest.fn();
        decoratedCollection.replaceFieldWriting('age', ageDefinition);

        // when
        await decoratedCollection.update(factories.caller.build(), factories.filter.build(), {
          name: 'orius',
          age: '10',
        });

        // then
        expect(nameDefinition).toHaveBeenCalledWith(
          'orius',
          expect.objectContaining({
            action: 'update',
            record: { name: 'orius', age: '10' },
          }),
        );
        expect(ageDefinition).toHaveBeenCalledWith(
          '10',
          expect.objectContaining({
            action: 'update',
            record: { name: 'orius', age: '10' },
          }),
        );
      });

      it('the given record in the context of the definition should be a copy', async () => {
        // given
        const dataSource = factories.dataSource.buildWithCollection(
          factories.collection.build({
            name: 'books',
            schema: factories.collectionSchema.build({
              fields: {
                name: factories.columnSchema.build({ columnType: 'String' }),
                age: factories.columnSchema.build({ columnType: 'String' }),
              },
            }),
          }),
        );
        const collection = dataSource.getCollection('books');

        const decoratedCollection = new WriteDecorator(collection, dataSource);

        const nameDefinition = jest.fn().mockImplementation((_, context) => {
          context.record.ADDED_FIELD = 'IS A COPY';
        });
        decoratedCollection.replaceFieldWriting('name', nameDefinition);

        const ageDefinition = jest.fn();
        decoratedCollection.replaceFieldWriting('age', ageDefinition);

        // when
        await decoratedCollection.update(factories.caller.build(), factories.filter.build(), {
          name: 'orius',
          age: '10',
        });

        // then
        expect(nameDefinition).toHaveBeenCalledWith(
          'orius',
          expect.objectContaining({
            record: { name: 'orius', age: '10', ADDED_FIELD: 'IS A COPY' },
          }),
        );
        expect(ageDefinition).toHaveBeenCalledWith(
          '10',
          expect.objectContaining({
            record: { name: 'orius', age: '10' }, // ADDED_FIELD should not be hear
          }),
        );
      });

      it('updates child collection without the triggered fields', async () => {
        // given
        const dataSource = factories.dataSource.buildWithCollection(
          factories.collection.build({
            name: 'books',
            schema: factories.collectionSchema.build({
              fields: {
                name: factories.columnSchema.build({ columnType: 'String' }),
                age: factories.columnSchema.build({ columnType: 'String' }),
              },
            }),
          }),
        );
        const collection = dataSource.getCollection('books');
        const decoratedCollection = new WriteDecorator(collection, dataSource);
        const nameDefinition = jest.fn();
        decoratedCollection.replaceFieldWriting('name', nameDefinition);
        const ageDefinition = jest.fn();
        decoratedCollection.replaceFieldWriting('age', ageDefinition);

        // when
        const caller = factories.caller.build();
        const filter = factories.filter.build();
        await decoratedCollection.update(caller, filter, { name: 'orius', age: '10' });

        // then
        expect(collection.update).toHaveBeenCalledWith(caller, filter, {});
      });
    });
  });

  describe('when handler returns a patch', () => {
    const setupWithManyToOneRelation = () => {
      const prices = factories.collection.build({
        name: 'prices',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build(),
            value: factories.columnSchema.build({ columnType: 'Number' }),
          },
        }),
      });

      const persons = factories.collection.build({
        name: 'persons',
        schema: factories.collectionSchema.build({
          fields: {
            id: factories.columnSchema.isPrimaryKey().build(),
            name: factories.columnSchema.build({ columnType: 'String' }),
            priceId: factories.columnSchema.build({ columnType: 'Uuid' }),
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
            authorId: factories.columnSchema.build({ columnType: 'Uuid' }),
            title: factories.columnSchema.build({ columnType: 'String' }),
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
                originKey: 'bookId',
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
              bookId: factories.columnSchema.build({ columnType: 'Uuid' }),
              name: factories.columnSchema.build({ columnType: 'String' }),
            },
          }),
        }),
      ]);

      return { dataSource, collection: dataSource.getCollection('books') };
    };

    describe('update', () => {
      it('updates child collection with the result of the definition', async () => {
        // given
        const dataSource = factories.dataSource.buildWithCollection(
          factories.collection.build({
            name: 'books',
            schema: factories.collectionSchema.build({
              fields: {
                name: factories.columnSchema.build({ columnType: 'String' }),
              },
            }),
          }),
        );
        const collection = dataSource.getCollection('books');
        const decoratedCollection = new WriteDecorator(collection, dataSource);

        const nameDefinition = jest.fn().mockResolvedValue({ name: 'changed name' });
        decoratedCollection.replaceFieldWriting('name', nameDefinition);

        // when
        const caller = factories.caller.build();
        const filter = factories.filter.build();
        await decoratedCollection.update(caller, filter, { name: 'orius', otherField: 'a value' });

        // then
        expect(collection.update).toHaveBeenCalledWith(caller, filter, {
          name: 'changed name',
          otherField: 'a value',
        });
      });

      describe('when the definition does not return a valid record', () => {
        it('should throw an error', async () => {
          // given
          const dataSource = factories.dataSource.buildWithCollection(
            factories.collection.build({
              name: 'books',
              schema: factories.collectionSchema.build({
                fields: {
                  age: factories.columnSchema.build({ columnType: 'String' }),
                },
              }),
            }),
          );
          const collection = dataSource.getCollection('books');

          const decoratedCollection = new WriteDecorator(collection, dataSource);
          const ageDefinition = jest.fn().mockResolvedValue('RETURN_SHOULD_FAIL');
          decoratedCollection.replaceFieldWriting('age', ageDefinition);

          // when/then
          await expect(() =>
            decoratedCollection.update(factories.caller.build(), factories.filter.build(), {
              age: '10',
            }),
          ).rejects.toThrowError('The write handler of age should return an object or nothing.');
        });
      });

      describe('when the definition returns a relation value', () => {
        describe('when it returns an unknown relation', () => {
          it('should throw an error', async () => {
            // given
            const dataSource = factories.dataSource.buildWithCollection(
              factories.collection.build({
                name: 'books',
                schema: factories.collectionSchema.build({
                  fields: {
                    age: factories.columnSchema.build({ columnType: 'String' }),
                  },
                }),
              }),
            );
            const collection = dataSource.getCollection('books');

            const decoratedCollection = new WriteDecorator(collection, dataSource);
            const ageDefinition = jest.fn().mockResolvedValue({ book: { title: 'A title' } });
            decoratedCollection.replaceFieldWriting('age', ageDefinition);

            // when/then
            await expect(() =>
              decoratedCollection.update(factories.caller.build(), factories.filter.build(), {
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
            const titleDefinition = jest
              .fn()
              .mockResolvedValue({ myAuthor: { name: 'NAME TO CHANGE' } });
            decoratedCollection.replaceFieldWriting('title', titleDefinition);

            const personsCollection = dataSource.getCollection('persons');
            collection.list = jest
              .fn()
              .mockResolvedValue([
                { authorId: '123e4567-e89b-12d3-a456-111111111111' },
                { authorId: '123e4567-e89b-12d3-a456-222222222222' },
              ]);

            // when
            const caller = factories.caller.build();
            const conditionTree = factories.conditionTreeLeaf.build();
            await decoratedCollection.update(caller, factories.filter.build({ conditionTree }), {
              title: 'a title',
            });

            // then
            expect(collection.list).toHaveBeenCalledWith(
              caller,
              new PaginatedFilter({ conditionTree }),
              ['authorId'],
            );
            expect(collection.update).toHaveBeenCalledWith(
              caller,
              new PaginatedFilter({ conditionTree }),
              {},
            );
            expect(personsCollection.update).toHaveBeenCalledWith(
              caller,
              new Filter({
                conditionTree: factories.conditionTreeLeaf.build({
                  operator: 'In',
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

            const decoratedDataSource = new DataSourceDecorator(dataSource, WriteDecorator);

            const pricesCollection = decoratedDataSource.getCollection('prices');
            pricesCollection.update = jest.fn();

            const decoratedCollection = decoratedDataSource.getCollection('books');
            const titleDefinition = jest
              .fn()
              .mockResolvedValue({ myAuthor: { myPrice: { value: 10 } } });
            decoratedCollection.replaceFieldWriting('title', titleDefinition);

            decoratedCollection.list = jest
              .fn()
              .mockResolvedValue([{ authorId: '123e4567-e89b-12d3-a456-111111111111' }]);

            const personsCollection = decoratedDataSource.getCollection('persons');
            personsCollection.list = jest
              .fn()
              .mockResolvedValue([{ priceId: '123e4567-e89b-12d3-a456-333333333333' }]);

            // when
            const caller = factories.caller.build();
            const conditionTree = factories.conditionTreeLeaf.build();
            await decoratedCollection.update(caller, factories.filter.build({ conditionTree }), {
              title: 'a title',
            });

            // then
            expect(decoratedCollection.list).toHaveBeenCalledWith(
              caller,
              new PaginatedFilter({ conditionTree }),
              ['authorId'],
            );
            expect(personsCollection.list).toHaveBeenCalledWith(
              caller,
              new Filter({
                conditionTree: factories.conditionTreeLeaf.build({
                  field: 'id',
                  value: ['123e4567-e89b-12d3-a456-111111111111'],
                  operator: 'In',
                }),
              }),
              ['priceId'],
            );

            expect(collection.update).toHaveBeenCalledWith(
              caller,
              new PaginatedFilter({ conditionTree }),
              {},
            );
            expect(pricesCollection.update).toHaveBeenCalledWith(
              caller,
              new Filter({
                conditionTree: factories.conditionTreeLeaf.build({
                  operator: 'In',
                  value: ['123e4567-e89b-12d3-a456-333333333333'],
                  field: 'id',
                }),
              }),
              { value: 10 },
            );
          });
        });

        describe('with one to one relation', () => {
          it('updates the right relation collection with the right params', async () => {
            // given
            const { collection, dataSource } = setupWithOneToOneRelation();
            const decoratedCollection = new WriteDecorator(collection, dataSource);
            const titleDefinition = jest
              .fn()
              .mockResolvedValue({ myOwner: { name: 'NAME TO CHANGE' } });
            decoratedCollection.replaceFieldWriting('title', titleDefinition);
            collection.list = jest
              .fn()
              .mockResolvedValue([{ id: '123e4567-e89b-12d3-a456-111111111111' }]);

            // when
            const caller = factories.caller.build();
            const filter = factories.filter.build({
              conditionTree: factories.conditionTreeLeaf.build({
                operator: 'Equal',
                value: 'a name',
                field: 'name',
              }),
            });

            await decoratedCollection.update(caller, filter, { title: 'a title' });

            // then
            expect(collection.list).toHaveBeenCalledWith(caller, filter, ['id']);

            const ownersCollection = dataSource.getCollection('owners');
            const conditionTreeBookId = factories.conditionTreeLeaf.build({
              operator: 'In',
              value: ['123e4567-e89b-12d3-a456-111111111111'],
              field: 'bookId',
            });
            expect(collection.update).toHaveBeenCalledWith(caller, filter, {});
            expect(ownersCollection.update).toHaveBeenCalledWith(
              caller,
              new Filter({ conditionTree: conditionTreeBookId }),
              { name: 'NAME TO CHANGE' },
            );
          });
        });

        describe('when the handler definition returns a relation value', () => {
          it('updates child collection with the handler definitions results', async () => {
            // given
            const dataSource = factories.dataSource.buildWithCollection(
              factories.collection.build({
                name: 'books',
                schema: factories.collectionSchema.build({
                  fields: {
                    name: factories.columnSchema.build({ columnType: 'String' }),
                    age: factories.columnSchema.build({ columnType: 'String' }),
                  },
                }),
              }),
            );
            const collection = dataSource.getCollection('books');

            const decoratedCollection = new WriteDecorator(collection, dataSource);
            const nameDefinition = jest.fn().mockResolvedValue({ name: 'changed name' });
            decoratedCollection.replaceFieldWriting('name', nameDefinition);
            const ageDefinition = jest.fn().mockResolvedValue({ age: 'changedAge' });
            decoratedCollection.replaceFieldWriting('age', ageDefinition);

            // when
            const caller = factories.caller.build();
            const filter = factories.filter.build();
            await decoratedCollection.update(caller, filter, { name: 'orius', age: '10' });

            // then
            expect(collection.update).toHaveBeenCalledWith(caller, filter, {
              name: 'changed name',
              age: 'changedAge',
            });
          });
        });

        describe('when the handler returns a field value with an other handler', () => {
          it('should trigger the targeted handler definition', async () => {
            // given
            const dataSource = factories.dataSource.buildWithCollection(
              factories.collection.build({
                name: 'books',
                schema: factories.collectionSchema.build({
                  fields: {
                    name: factories.columnSchema.build({ columnType: 'String' }),
                    age: factories.columnSchema.build({ columnType: 'String' }),
                  },
                }),
              }),
            );
            const collection = dataSource.getCollection('books');

            const decoratedCollection = new WriteDecorator(collection, dataSource);
            const nameDefinition = jest.fn().mockResolvedValue({ name: 'triggeredChangedName' });
            decoratedCollection.replaceFieldWriting('name', nameDefinition);
            const ageDefinitionTriggerName = jest.fn().mockResolvedValue({ name: 'changed name' });
            decoratedCollection.replaceFieldWriting('age', ageDefinitionTriggerName);

            // when
            const caller = factories.caller.build();
            await decoratedCollection.update(caller, factories.filter.build(), {
              age: '10',
            });

            // then
            expect(collection.update).toHaveBeenCalledWith(caller, expect.any(PaginatedFilter), {
              name: 'triggeredChangedName',
            });
          });

          it('should trigger as long as there is handler definition targeted', async () => {
            // given
            const dataSource = factories.dataSource.buildWithCollection(
              factories.collection.build({
                name: 'books',
                schema: factories.collectionSchema.build({
                  fields: {
                    name: factories.columnSchema.build({ columnType: 'String' }),
                    price: factories.columnSchema.build({ columnType: 'String' }),
                    age: factories.columnSchema.build({ columnType: 'String' }),
                  },
                }),
              }),
            );
            const collection = dataSource.getCollection('books');

            const decoratedCollection = new WriteDecorator(collection, dataSource);
            const priceDefinition = jest.fn().mockResolvedValue({ price: 'triggeredChangedPrice' });
            decoratedCollection.replaceFieldWriting('price', priceDefinition);
            const nameDefinition = jest.fn().mockResolvedValue({ price: 'triggeredChangedName' });
            decoratedCollection.replaceFieldWriting('name', nameDefinition);
            const ageDefinitionTriggerName = jest.fn().mockResolvedValue({ name: 'changed name' });
            decoratedCollection.replaceFieldWriting('age', ageDefinitionTriggerName);

            // when
            const caller = factories.caller.build();
            const filter = factories.filter.build();
            await decoratedCollection.update(caller, filter, { age: '10' });

            // then
            expect(collection.update).toHaveBeenCalledWith(caller, expect.any(PaginatedFilter), {
              price: 'triggeredChangedPrice',
            });
          });

          it('throws an error if the same handler is triggered several times', async () => {
            // given
            const dataSource = factories.dataSource.buildWithCollection(
              factories.collection.build({
                name: 'books',
                schema: factories.collectionSchema.build({
                  fields: {
                    name: factories.columnSchema.build({ columnType: 'String' }),
                    age: factories.columnSchema.build({ columnType: 'String' }),
                  },
                }),
              }),
            );
            const collection = dataSource.getCollection('books');

            const decoratedCollection = new WriteDecorator(collection, dataSource);
            const nameDefinition = jest.fn().mockResolvedValue({ name: 'triggeredSecondTime' });
            decoratedCollection.replaceFieldWriting('name', nameDefinition);
            const ageDefinitionTriggerName = jest.fn().mockResolvedValue({ name: 'changed name' });
            decoratedCollection.replaceFieldWriting('age', ageDefinitionTriggerName);

            // when/then
            await expect(() =>
              decoratedCollection.update(factories.caller.build(), factories.filter.build(), {
                age: '10',
                name: 'triggeredOneTime',
              }),
            ).rejects.toThrow(
              new ValidationError(
                'Conflict value on the field "name". It receives several values.',
              ),
            );
          });

          it('should throw an error if there is a cyclic dependency', async () => {
            // given
            const dataSource = factories.dataSource.buildWithCollection(
              factories.collection.build({
                name: 'books',
                schema: factories.collectionSchema.build({
                  fields: {
                    name: factories.columnSchema.build({ columnType: 'String' }),
                    age: factories.columnSchema.build({ columnType: 'String' }),
                  },
                }),
              }),
            );
            const collection = dataSource.getCollection('books');

            const decoratedCollection = new WriteDecorator(collection, dataSource);
            const nameDefinition = jest.fn().mockResolvedValue({ age: 'cyclic dependency' });
            decoratedCollection.replaceFieldWriting('name', nameDefinition);
            const ageDefinitionTriggerName = jest.fn().mockResolvedValue({ name: 'changed name' });
            decoratedCollection.replaceFieldWriting('age', ageDefinitionTriggerName);

            // when/then
            await expect(() =>
              decoratedCollection.update(factories.caller.build(), factories.filter.build(), {
                age: '10',
              }),
            ).rejects.toThrow(
              new ValidationError('There is a cyclic dependency on the "age" column.'),
            );
          });
        });
      });
    });

    describe('create', () => {
      it('calls create on the child collection with the result of the handler', async () => {
        // given
        const dataSource = factories.dataSource.buildWithCollection(
          factories.collection.build({
            name: 'books',
            schema: factories.collectionSchema.build({
              fields: {
                name: factories.columnSchema.build({ columnType: 'String' }),
              },
            }),
          }),
        );
        const collection = dataSource.getCollection('books');

        const decoratedCollection = new WriteDecorator(collection, dataSource);

        decoratedCollection.replaceFieldWriting('name', () => ({ name: 'changed name' }));
        collection.create = jest.fn().mockResolvedValue([
          {
            name: 'changed name',
            otherField: 'other value',
          },
        ]);

        // when
        const caller = factories.caller.build();
        await decoratedCollection.create(caller, [
          { name: 'orius', otherField: 'other value 1' },
          { name: 'orius', otherField: 'other value 2' },
        ]);

        // then
        expect(collection.create).toHaveBeenNthCalledWith(1, caller, [
          { name: 'changed name', otherField: 'other value 1' },
        ]);
        expect(collection.create).toHaveBeenNthCalledWith(2, caller, [
          { name: 'changed name', otherField: 'other value 2' },
        ]);
      });

      describe('with one to one relation', () => {
        describe('when the relation does not exist', () => {
          it('creates the relation and attaches to the new collection', async () => {
            // given
            const { collection, dataSource } = setupWithOneToOneRelation();
            const ownersCollection = dataSource.getCollection('owners');

            const decoratedCollection = new WriteDecorator(collection, dataSource);
            const titleDefinition = jest
              .fn()
              .mockResolvedValue({ myOwner: { name: 'NAME TO CHANGE' }, title: 'name' });
            decoratedCollection.replaceFieldWriting('title', titleDefinition);
            collection.create = jest
              .fn()
              .mockResolvedValue([
                { id: '123e4567-e89b-12d3-a456-111111111111', notImportantColumn: 'foo' },
              ]);

            // when
            const caller = factories.caller.build();
            await decoratedCollection.create(caller, [{ title: 'a title' }]);

            // then
            expect(ownersCollection.create).toHaveBeenCalledWith(caller, [
              { name: 'NAME TO CHANGE', bookId: '123e4567-e89b-12d3-a456-111111111111' },
            ]);
            expect(collection.create).toHaveBeenCalledWith(caller, [{ title: 'name' }]);
          });

          describe('when the handler definition returns several relations', () => {
            const setupWithTwoOneToOneRelations = () => {
              const dataSource = factories.dataSource.buildWithCollections([
                factories.collection.build({
                  name: 'books',
                  schema: factories.collectionSchema.build({
                    fields: {
                      id: factories.columnSchema.isPrimaryKey().build(),
                      myOwner: factories.oneToOneSchema.build({
                        foreignCollection: 'owners',
                        originKey: 'bookId',
                      }),
                      myFormat: factories.oneToOneSchema.build({
                        foreignCollection: 'formats',
                        originKey: 'bookId',
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
                      bookId: factories.columnSchema.build({ columnType: 'Uuid' }),
                      name: factories.columnSchema.build({ columnType: 'String' }),
                    },
                  }),
                }),
                factories.collection.build({
                  name: 'formats',
                  schema: factories.collectionSchema.build({
                    fields: {
                      id: factories.columnSchema.isPrimaryKey().build(),
                      bookId: factories.columnSchema.build({ columnType: 'Uuid' }),
                      name: factories.columnSchema.build({ columnType: 'String' }),
                    },
                  }),
                }),
              ]);

              return { dataSource, collection: dataSource.getCollection('books') };
            };

            it('creates the relations and attaches to the new collection', async () => {
              // given
              const { collection, dataSource } = setupWithTwoOneToOneRelations();
              const ownersCollection = dataSource.getCollection('owners');
              const formatsCollection = dataSource.getCollection('formats');

              const decoratedCollection = new WriteDecorator(collection, dataSource);
              const titleDefinition = jest.fn().mockResolvedValue({
                myOwner: { name: 'Orius' },
                myFormat: { name: 'XXL' },
                title: 'name',
              });
              decoratedCollection.replaceFieldWriting('title', titleDefinition);
              collection.create = jest
                .fn()
                .mockResolvedValue([
                  { id: '123e4567-e89b-12d3-a456-111111111111', notImportantColumn: 'foo' },
                ]);

              // when
              const caller = factories.caller.build();
              await decoratedCollection.create(caller, [{ title: 'a title' }]);

              // then
              expect(ownersCollection.create).toHaveBeenCalledWith(caller, [
                { name: 'Orius', bookId: '123e4567-e89b-12d3-a456-111111111111' },
              ]);
              expect(formatsCollection.create).toHaveBeenCalledWith(caller, [
                { name: 'XXL', bookId: '123e4567-e89b-12d3-a456-111111111111' },
              ]);
              expect(collection.create).toHaveBeenCalledTimes(1);
              expect(collection.create).toHaveBeenCalledWith(caller, [{ title: 'name' }]);
            });
          });
        });

        describe('when the foreign key is given', () => {
          it('updates the relation and attaches to the new collection', async () => {
            // given
            const { collection, dataSource } = setupWithOneToOneRelation();
            const ownersCollection = dataSource.getCollection('owners');

            const decoratedCollection = new WriteDecorator(collection, dataSource);
            const titleDefinition = jest
              .fn()
              .mockResolvedValue({ myOwner: { name: 'NAME TO CHANGE' }, title: 'name' });
            decoratedCollection.replaceFieldWriting('title', titleDefinition);
            collection.create = jest.fn().mockResolvedValue([{ title: 'name' }]);

            // when
            const caller = factories.caller.build();
            await decoratedCollection.create(caller, [
              { title: 'a title', bookId: '123e4567-e89b-12d3-a456-111111111111' },
            ]);

            // then
            expect(collection.create).toHaveBeenCalledWith(caller, [{ title: 'name' }]);
            expect(ownersCollection.update).toHaveBeenCalledWith(
              caller,
              new Filter({
                conditionTree: factories.conditionTreeLeaf.build({
                  operator: 'Equal',
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
            // given
            const { collection, dataSource } = setupWithManyToOneRelation();

            const decoratedCollection = new WriteDecorator(collection, dataSource);
            const titleDefinition = jest
              .fn()
              .mockResolvedValue({ myAuthor: { name: 'NAME TO CHANGE' } });
            decoratedCollection.replaceFieldWriting('title', titleDefinition);

            const personsCollection = dataSource.getCollection('persons');
            personsCollection.create = jest
              .fn()
              .mockResolvedValue([
                { id: '123e4567-e89b-12d3-a456-111111111111', name: 'NAME TO CHANGE' },
              ]);
            collection.create = jest.fn().mockResolvedValue([{ title: 'name' }]);

            // when
            const caller = factories.caller.build();
            await decoratedCollection.create(caller, [{ title: 'a title' }]);

            // then
            expect(collection.create).toHaveBeenCalledWith(caller, [
              { authorId: '123e4567-e89b-12d3-a456-111111111111' },
            ]);
            expect(personsCollection.create).toHaveBeenCalledWith(caller, [
              { name: 'NAME TO CHANGE' },
            ]);
          });

          describe('when the handler definition returns several relations', () => {
            const setupWithTwoManyToOneRelations = () => {
              const formats = factories.collection.build({
                name: 'formats',
                schema: factories.collectionSchema.build({
                  fields: {
                    id: factories.columnSchema.isPrimaryKey().build(),
                    name: factories.columnSchema.build({ columnType: 'String' }),
                  },
                }),
              });

              const authors = factories.collection.build({
                name: 'authors',
                schema: factories.collectionSchema.build({
                  fields: {
                    id: factories.columnSchema.isPrimaryKey().build(),
                    name: factories.columnSchema.build({ columnType: 'String' }),
                    priceId: factories.columnSchema.build({ columnType: 'Uuid' }),
                  },
                }),
              });

              const books = factories.collection.build({
                name: 'books',
                schema: factories.collectionSchema.build({
                  fields: {
                    id: factories.columnSchema.isPrimaryKey().build(),
                    title: factories.columnSchema.build({ columnType: 'String' }),
                    authorId: factories.columnSchema.build({ columnType: 'Uuid' }),
                    myAuthor: factories.manyToOneSchema.build({
                      foreignCollection: 'authors',
                      foreignKey: 'authorId',
                    }),
                    formatId: factories.columnSchema.build({ columnType: 'Uuid' }),
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
              // given
              const { collection, dataSource } = setupWithTwoManyToOneRelations();
              const authorsCollection = dataSource.getCollection('authors');
              const formatsCollection = dataSource.getCollection('formats');

              const decoratedCollection = new WriteDecorator(collection, dataSource);
              const titleDefinition = jest.fn().mockResolvedValue({
                myAuthor: { name: 'Orius' },
                myFormat: { name: 'XXL' },
                title: 'name',
              });
              decoratedCollection.replaceFieldWriting('title', titleDefinition);

              authorsCollection.create = jest
                .fn()
                .mockResolvedValue([{ id: '123e4567-e89b-12d3-a456-111111111111', name: 'Orius' }]);
              formatsCollection.create = jest
                .fn()
                .mockResolvedValue([{ id: '123e4567-e89b-12d3-a456-222222222222', name: 'XXL' }]);
              collection.create = jest.fn().mockResolvedValue([{ title: 'name' }]);

              // when
              const caller = factories.caller.build();
              await decoratedCollection.create(caller, [{ title: 'a title' }]);

              // then
              expect(authorsCollection.create).toHaveBeenCalledWith(caller, [{ name: 'Orius' }]);
              expect(formatsCollection.create).toHaveBeenCalledWith(caller, [{ name: 'XXL' }]);
              expect(collection.create).toHaveBeenCalledWith(caller, [
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
            // given
            const { collection, dataSource } = setupWithManyToOneRelation();

            const decoratedCollection = new WriteDecorator(collection, dataSource);
            const titleDefinition = jest
              .fn()
              .mockResolvedValue({ myAuthor: { name: 'NAME TO CHANGE' } });
            decoratedCollection.replaceFieldWriting('title', titleDefinition);

            const personsCollection = dataSource.getCollection('persons');
            personsCollection.create = jest
              .fn()
              .mockResolvedValue([
                { id: '123e4567-e89b-12d3-a456-111111111111', name: 'NAME TO CHANGE' },
              ]);
            collection.create = jest.fn().mockResolvedValue([{ title: 'name' }]);

            // when
            const caller = factories.caller.build();
            await decoratedCollection.create(caller, [
              { title: 'a title', authorId: '123e4567-e89b-12d3-a456-111111111111' },
            ]);

            // then
            expect(collection.create).toHaveBeenCalledWith(caller, [
              { authorId: '123e4567-e89b-12d3-a456-111111111111' },
            ]);
            expect(personsCollection.update).toHaveBeenCalledWith(
              caller,
              new Filter({
                conditionTree: factories.conditionTreeLeaf.build({
                  operator: 'Equal',
                  value: '123e4567-e89b-12d3-a456-111111111111',
                  field: 'id',
                }),
              }),
              { name: 'NAME TO CHANGE' },
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
                    originKey: 'bookId',
                  }),
                  formatId: factories.columnSchema.build({ columnType: 'Uuid' }),
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
                  bookId: factories.columnSchema.build({ columnType: 'Uuid' }),
                  name: factories.columnSchema.build({ columnType: 'String' }),
                },
              }),
            }),
            factories.collection.build({
              name: 'formats',
              schema: factories.collectionSchema.build({
                fields: {
                  id: factories.columnSchema.isPrimaryKey().build(),
                  name: factories.columnSchema.build({ columnType: 'String' }),
                },
              }),
            }),
          ]);

          return { dataSource, collection: dataSource.getCollection('books') };
        };

        it('creates the relations and attaches to the new collection', async () => {
          // given
          const { collection, dataSource } = setupWithManyToOneAndOneToOneRelation();
          const authorsCollection = dataSource.getCollection('authors');
          const formatsCollection = dataSource.getCollection('formats');

          const decoratedCollection = new WriteDecorator(collection, dataSource);
          const titleDefinition = jest.fn().mockResolvedValue({
            myAuthor: { name: 'Orius' },
            myFormat: { name: 'XXL' },
            title: 'a name',
          });
          decoratedCollection.replaceFieldWriting('title', titleDefinition);

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
          const caller = factories.caller.build();
          await decoratedCollection.create(caller, [{ title: 'a title' }]);

          // then
          expect(collection.create).toHaveBeenCalledTimes(1);
          expect(collection.create).toHaveBeenCalledWith(caller, [
            { formatId: '123e4567-e89b-12d3-a456-222222222222', title: 'a name' },
          ]);
          expect(authorsCollection.create).toHaveBeenCalledWith(caller, [
            { bookId: '123e4567-e89b-12d3-a456-426614174087', name: 'Orius' },
          ]);
          expect(formatsCollection.create).toHaveBeenCalledWith(caller, [{ name: 'XXL' }]);
        });
      });
    });
  });
});
