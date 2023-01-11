import { Collection } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import WriteDataSourceDecorator from '../../../../src/decorators/write/datasource';
import WriteReplacerCollectionDecorator from '../../../../src/decorators/write/write-replace/collection';

const caller = factories.caller.build();

describe('WriteDecorator > Create with no relations', () => {
  let collection: Collection;
  let decorator: WriteReplacerCollectionDecorator;

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
        create: jest.fn().mockImplementation((_, records) => records),
      }),
    );

    collection = dataSource.getCollection('books');
    decorator = new WriteDataSourceDecorator(dataSource).getCollection('books');
  });

  describe('should do nothing', () => {
    test('when no rewritting is defined', async () => {
      const records = [{ name: 'a name' }, { name: 'another name' }];
      const result = await decorator.create(caller, records);

      expect(result).toStrictEqual(records);
      expect(collection.create).toHaveBeenCalledWith(caller, records);
    });
  });

  describe('should work', () => {
    test('with a empty handler', async () => {
      const handler = jest.fn().mockImplementation();
      decorator.replaceFieldWriting('name', handler);

      await decorator.create(caller, [{ name: 'a name', age: 'some age' }]);

      expect(collection.create).toHaveBeenCalledWith(caller, [{ age: 'some age' }]);
      expect(handler).toHaveBeenCalledWith(
        'a name',
        expect.objectContaining({ action: 'create', record: { name: 'a name', age: 'some age' } }),
      );
    });

    test('when writing on the same field in the handler', async () => {
      const handler = jest.fn().mockResolvedValue({ name: 'another name' });
      decorator.replaceFieldWriting('name', handler);

      await decorator.create(caller, [{ name: 'a name' }]);

      expect(collection.create).toHaveBeenCalledWith(caller, [{ name: 'another name' }]);
      expect(handler).toHaveBeenCalledWith(
        'a name',
        expect.objectContaining({ action: 'create', record: { name: 'a name' } }),
      );
    });

    test('when writing on another field in the handler', async () => {
      // Write on name, rewrite on age
      const handler = jest.fn().mockResolvedValue({ age: 'some age' });
      decorator.replaceFieldWriting('name', handler);

      await decorator.create(caller, [{ name: 'a name' }]);

      expect(collection.create).toHaveBeenCalledWith(caller, [{ age: 'some age' }]);
      expect(handler).toHaveBeenCalledWith(
        'a name',
        expect.objectContaining({ action: 'create', record: { name: 'a name' } }),
      );
    });

    test('when unrelated rewritters are used in parallel', async () => {
      const ageHandler = jest.fn().mockResolvedValue({ age: 'new age' });
      decorator.replaceFieldWriting('age', ageHandler);

      const priceHandler = jest.fn().mockResolvedValue({ price: 'new price' });
      decorator.replaceFieldWriting('price', priceHandler);

      await decorator.create(caller, [{ name: 'name', price: 'price', age: 'age' }]);

      expect(collection.create).toHaveBeenCalledWith(caller, [
        { name: 'name', age: 'new age', price: 'new price' },
      ]);
      expect(ageHandler).toHaveBeenCalledWith(
        'age',
        expect.objectContaining({
          action: 'create',
          record: { name: 'name', age: 'age', price: 'price' },
        }),
      );
      expect(priceHandler).toHaveBeenCalledWith(
        'price',
        expect.objectContaining({
          action: 'create',
          record: { name: 'name', age: 'age', price: 'price' },
        }),
      );
    });

    test('when doing nested rewriting in the handler', async () => {
      // Write on name, rewrite on age, rewrite on price
      const nameHandler = jest.fn().mockResolvedValue({ age: 'some age' });
      const ageHandler = jest.fn().mockResolvedValue({ price: 'some price' });
      decorator.replaceFieldWriting('name', nameHandler);
      decorator.replaceFieldWriting('age', ageHandler);

      await decorator.create(caller, [{ name: 'a name' }]);

      expect(collection.create).toHaveBeenCalledWith(caller, [{ price: 'some price' }]);
      expect(nameHandler).toHaveBeenCalledWith(
        'a name',
        expect.objectContaining({ action: 'create', record: { name: 'a name' } }),
      );
      expect(ageHandler).toHaveBeenCalledWith(
        'some age',
        expect.objectContaining({ action: 'create', record: { age: 'some age' } }),
      );
    });
  });

  describe('should throw', () => {
    test('when two handlers request conflicting updates', async () => {
      decorator.replaceFieldWriting('name', () => ({ price: '123' }));
      decorator.replaceFieldWriting('age', () => ({ price: '456' }));

      await expect(decorator.create(caller, [{ name: 'a name', age: 'an age' }])).rejects.toThrow(
        'Conflict value on the field "price". It received several values.',
      );
    });

    test('when handlers call themselve recursively', async () => {
      decorator.replaceFieldWriting('name', () => ({ age: 'some age' }));
      decorator.replaceFieldWriting('age', () => ({ price: 'some price' }));
      decorator.replaceFieldWriting('price', () => ({ name: 'some name' }));

      await expect(decorator.create(caller, [{ name: 'a name' }])).rejects.toThrow(
        'Cycle detected: name -> age -> price.',
      );
    });

    test('when the handler returns a unexpected type', async () => {
      decorator.replaceFieldWriting('age', async () => 'RETURN_SHOULD_FAIL');

      await expect(decorator.create(caller, [{ age: '10' }])).rejects.toThrow(
        'The write handler of age should return an object or nothing.',
      );
    });

    test('when the handler returns non existent fields', async () => {
      decorator.replaceFieldWriting('age', () => ({ author: 'Asimov' }));

      await expect(decorator.create(caller, [{ age: '10' }])).rejects.toThrow(
        'Unknown field: "author"',
      );
    });

    test('when the handler returns non existent relations', async () => {
      decorator.replaceFieldWriting('age', () => ({ author: { lastname: 'Asimov' } }));

      await expect(decorator.create(caller, [{ age: '10' }])).rejects.toThrow(
        'Unknown field: "author"',
      );
    });

    test('if the customer attemps to update the patch in the handler', async () => {
      decorator.replaceFieldWriting('name', (value, context) => {
        context.record.ADDED_FIELD = 'updating the patch';
      });

      await expect(decorator.create(caller, [{ name: 'orius' }])).rejects.toThrow(
        'Cannot add property ADDED_FIELD, object is not extensible',
      );
    });

    test('when a handler throws', async () => {
      decorator.replaceFieldWriting('name', () => {
        throw new Error('Some error');
      });

      await expect(decorator.create(caller, [{ name: 'a name' }])).rejects.toThrow('Some error');
    });

    test('when a handler rejects', async () => {
      decorator.replaceFieldWriting('name', () => Promise.reject(new Error('Some error')));

      await expect(decorator.create(caller, [{ name: 'a name' }])).rejects.toThrow('Some error');
    });

    test('when not using the appropriate type', async () => {
      decorator.replaceFieldWriting('name', () => ({ age: 666 }));

      await expect(decorator.create(caller, [{ name: 'a name' }])).rejects.toThrow();
    });
  });
});
