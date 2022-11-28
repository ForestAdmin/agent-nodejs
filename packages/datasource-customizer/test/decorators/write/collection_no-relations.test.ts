import { Collection, Filter, PaginatedFilter } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import WriteDecorator from '../../../src/decorators/write/collection';

describe('WriteDecorator > When there are no relations', () => {
  let collection: Collection;
  let decorator: WriteDecorator;

  beforeEach(() => {
    const dataSource = factories.dataSource.buildWithCollection(
      factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            name: factories.columnSchema.build({ columnType: 'String' }),
            age: factories.columnSchema.build({ columnType: 'String' }),
            price: factories.columnSchema.build({ columnType: 'String' }),
          },
        }),
      }),
    );

    collection = dataSource.getCollection('books');
    decorator = new WriteDecorator(collection, dataSource);
  });

  describe('when the field has an handler', () => {
    describe('when it is updated', () => {
      it('should provide a handler definition with a patch and a context', async () => {
        collection.update = jest.fn().mockResolvedValue({ name: 'a name' });

        const handler = jest.fn().mockImplementation();
        decorator.replaceFieldWriting('name', handler);

        // when
        await decorator.update(factories.caller.build(), new Filter({}), {
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
        collection.create = jest.fn().mockResolvedValue([{ name: 'a name' }]);

        const handler = jest.fn().mockImplementation();
        decorator.replaceFieldWriting('name', handler);

        // when
        await decorator.create(factories.caller.build(), [{ name: 'a name' }]);

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

  describe('when handler returns nothing', () => {
    it('should trigger the definition function to update it', async () => {
      const handler = jest.fn().mockImplementation();
      decorator.replaceFieldWriting('name', handler);

      // when
      await decorator.update(factories.caller.build(), factories.filter.build(), {
        name: 'orius',
      });

      // then
      expect(handler).toHaveBeenCalledWith(
        'orius',
        expect.objectContaining({ action: 'update', record: { name: 'orius' } }),
      );
    });

    it('updates child collection without the triggered definition field', async () => {
      const handler = jest.fn().mockImplementation();
      decorator.replaceFieldWriting('name', handler);

      // when
      const caller = factories.caller.build();
      const filter = factories.filter.build();
      await decorator.update(caller, filter, { name: 'jean', otherField: 'aValue' });

      // then
      expect(collection.update).toHaveBeenCalledWith(caller, filter, { otherField: 'aValue' });
    });

    describe('when many fields have a definition', () => {
      it('should trigger all the definition function to update it', async () => {
        // given
        const nameDefinition = jest.fn();
        decorator.replaceFieldWriting('name', nameDefinition);
        const ageDefinition = jest.fn();
        decorator.replaceFieldWriting('age', ageDefinition);

        // when
        await decorator.update(factories.caller.build(), factories.filter.build(), {
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
        const nameDefinition = jest.fn().mockImplementation((_, context) => {
          context.record.ADDED_FIELD = 'IS A COPY';
        });
        decorator.replaceFieldWriting('name', nameDefinition);

        const ageDefinition = jest.fn();
        decorator.replaceFieldWriting('age', ageDefinition);

        // when
        await decorator.update(factories.caller.build(), factories.filter.build(), {
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
        const nameDefinition = jest.fn();
        decorator.replaceFieldWriting('name', nameDefinition);
        const ageDefinition = jest.fn();
        decorator.replaceFieldWriting('age', ageDefinition);

        // when
        const caller = factories.caller.build();
        const filter = factories.filter.build();
        await decorator.update(caller, filter, { name: 'orius', age: '10' });

        // then
        expect(collection.update).toHaveBeenCalledWith(caller, filter, {});
      });
    });
  });

  describe('when handler returns a patch', () => {
    describe('update', () => {
      it('updates child collection with the result of the definition', async () => {
        const nameDefinition = jest.fn().mockResolvedValue({ name: 'changed name' });
        decorator.replaceFieldWriting('name', nameDefinition);

        // when
        const caller = factories.caller.build();
        const filter = factories.filter.build();
        await decorator.update(caller, filter, { name: 'orius', otherField: 'a value' });

        // then
        expect(collection.update).toHaveBeenCalledWith(caller, filter, {
          name: 'changed name',
          otherField: 'a value',
        });
      });

      describe('when the definition returns a relation value', () => {
        describe('when the handler definition returns a relation value', () => {
          it('updates child collection with the handler definitions results', async () => {
            const nameDefinition = jest.fn().mockResolvedValue({ name: 'changed name' });
            decorator.replaceFieldWriting('name', nameDefinition);
            const ageDefinition = jest.fn().mockResolvedValue({ age: 'changedAge' });
            decorator.replaceFieldWriting('age', ageDefinition);

            // when
            const caller = factories.caller.build();
            const filter = factories.filter.build();
            await decorator.update(caller, filter, { name: 'orius', age: '10' });

            // then
            expect(collection.update).toHaveBeenCalledWith(caller, filter, {
              name: 'changed name',
              age: 'changedAge',
            });
          });
        });

        describe('when the handler returns a field value with an other handler', () => {
          it('should trigger the targeted handler definition', async () => {
            const nameDefinition = jest.fn().mockResolvedValue({ name: 'triggeredChangedName' });
            decorator.replaceFieldWriting('name', nameDefinition);
            const ageDefinitionTriggerName = jest.fn().mockResolvedValue({ name: 'changed name' });
            decorator.replaceFieldWriting('age', ageDefinitionTriggerName);

            // when
            const caller = factories.caller.build();
            await decorator.update(caller, factories.filter.build(), {
              age: '10',
            });

            // then
            expect(collection.update).toHaveBeenCalledWith(caller, expect.any(PaginatedFilter), {
              name: 'triggeredChangedName',
            });
          });

          it('should trigger as long as there is handler definition targeted', async () => {
            const priceDefinition = jest.fn().mockResolvedValue({ price: 'triggeredChangedPrice' });
            decorator.replaceFieldWriting('price', priceDefinition);
            const nameDefinition = jest.fn().mockResolvedValue({ price: 'triggeredChangedName' });
            decorator.replaceFieldWriting('name', nameDefinition);
            const ageDefinitionTriggerName = jest.fn().mockResolvedValue({ name: 'changed name' });
            decorator.replaceFieldWriting('age', ageDefinitionTriggerName);

            // when
            const caller = factories.caller.build();
            const filter = factories.filter.build();
            await decorator.update(caller, filter, { age: '10' });

            // then
            expect(collection.update).toHaveBeenCalledWith(caller, expect.any(PaginatedFilter), {
              price: 'triggeredChangedPrice',
            });
          });
        });
      });
    });

    describe('create', () => {
      it('calls create on the child collection with the result of the handler', async () => {
        decorator.replaceFieldWriting('name', () => ({ name: 'changed name' }));
        collection.create = jest.fn().mockResolvedValue([
          {
            name: 'changed name',
            otherField: 'other value',
          },
        ]);

        // when
        const caller = factories.caller.build();
        await decorator.create(caller, [
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
    });
  });
});
