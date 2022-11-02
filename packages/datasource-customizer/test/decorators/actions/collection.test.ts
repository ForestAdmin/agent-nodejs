import { ActionScope, Collection, DataSource, Filter } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import ActionCollection from '../../../src/decorators/actions/collection';
import DataSourceDecorator from '../../../src/decorators/datasource-decorator';

describe('ActionDecorator', () => {
  // State
  let dataSource: DataSource;
  let decoratedDataSource: DataSourceDecorator<ActionCollection>;
  let books: Collection;
  let newBooks: ActionCollection;

  beforeEach(() => {
    books = factories.collection.build({
      name: 'books',
      schema: factories.collectionSchema.build({
        fields: {
          id: factories.columnSchema.build({ isPrimaryKey: true }),
          title: factories.columnSchema.build(),
        },
      }),
      getForm: jest.fn().mockResolvedValue([]),
      execute: jest.fn().mockRejectedValue(new Error('no such action')),
    });

    dataSource = factories.dataSource.buildWithCollections([books]);
    decoratedDataSource = new DataSourceDecorator(dataSource, ActionCollection);
    newBooks = decoratedDataSource.getCollection('books');
  });

  describe('without actions', () => {
    test('should delegate execute calls', async () => {
      const caller = factories.caller.build();
      const filter = new Filter({});

      await expect(
        newBooks.execute(caller, 'someAction', { firstname: 'John' }, filter),
      ).rejects.toThrow('no such action');
      expect(books.execute).toHaveBeenCalledWith(
        caller,
        'someAction',
        { firstname: 'John' },
        filter,
      );
    });

    test('should delegate getForm calls', async () => {
      const caller = factories.caller.build();
      const filter = new Filter({});
      const fields = await newBooks.getForm(caller, 'someAction', { firstname: 'John' }, filter);

      expect(fields).toEqual([]);
      expect(books.getForm).toHaveBeenCalledWith(
        caller,
        'someAction',
        { firstname: 'John' },
        filter,
      );
    });
  });

  describe('with a bulk action with no form and void result', () => {
    beforeEach(() => {
      newBooks.addAction('make photocopy', {
        scope: 'Single',
        execute: jest.fn(),
      });
    });

    test('should be flagged as static form', () => {
      expect(newBooks.schema.actions['make photocopy']).toEqual({
        scope: 'Single',
        generateFile: false,
        staticForm: true,
      });
    });

    test('should execute and return default response', async () => {
      const filter = new Filter({});
      const result = await newBooks.execute(factories.caller.build(), 'make photocopy', {}, filter);

      expect(books.execute).not.toHaveBeenCalled();
      expect(result).toEqual({
        type: 'Success',
        invalidated: new Set(),
        message: 'Success',
      });
    });

    test('should generate empty form (without data)', async () => {
      const filter = new Filter({});
      const fields = await newBooks.getForm(
        factories.caller.build(),
        'make photocopy',
        null,
        filter,
      );

      expect(books.getForm).not.toHaveBeenCalled();
      expect(fields).toEqual([]);
    });

    test('should generate empty form (with data)', async () => {
      const filter = new Filter({});
      const fields = await newBooks.getForm(factories.caller.build(), 'make photocopy', {}, filter);

      expect(books.getForm).not.toHaveBeenCalled();
      expect(fields).toEqual([]);
    });
  });

  describe('with a global action with a static form', () => {
    beforeEach(() => {
      newBooks.addAction('make photocopy', {
        scope: 'Single',
        execute: (context, resultBuilder) => {
          return resultBuilder.error('meeh');
        },
        form: [
          { label: 'firstname', type: 'String' },
          { label: 'lastname', type: 'String' },
        ],
      });
    });

    test('should be flagged as static form', () => {
      expect(newBooks.schema.actions['make photocopy']).toEqual({
        scope: 'Single',
        generateFile: false,
        staticForm: true,
      });
    });

    test('should return the form', async () => {
      const fields = await newBooks.getForm(factories.caller.build(), 'make photocopy', {});

      expect(fields).toEqual([
        { label: 'firstname', type: 'String', watchChanges: false },
        { label: 'lastname', type: 'String', watchChanges: false },
      ]);
    });
  });

  describe('with single action with both load and change hooks', () => {
    beforeEach(() => {
      newBooks.addAction('make photocopy', {
        scope: 'Single',
        execute: (context, resultBuilder) => {
          return resultBuilder.error('meeh');
        },
        form: [
          {
            label: 'firstname',
            type: 'String',
            defaultValue: () => 'DynamicDefault',
          },
          {
            label: 'lastname',
            type: 'String',
            isReadOnly: context => !!context.formValues.firstname,
          },
        ],
      });
    });

    test('should be flagged as dynamic form', () => {
      expect(newBooks.schema.actions['make photocopy']).toEqual({
        scope: 'Single',
        generateFile: false,
        staticForm: false,
      });
    });

    test('should compute dynamic default value (no data == load hook)', async () => {
      const fields = await newBooks.getForm(factories.caller.build(), 'make photocopy', null);

      expect(fields).toEqual([
        {
          label: 'firstname',
          type: 'String',
          watchChanges: true,
          value: 'DynamicDefault',
        },
        { label: 'lastname', type: 'String', isReadOnly: true, watchChanges: false },
      ]);
    });

    test('should compute readonly (false) and keep null firstname', async () => {
      const fields = await newBooks.getForm(factories.caller.build(), 'make photocopy', {
        firstname: null,
      });

      expect(fields).toEqual([
        { label: 'firstname', type: 'String', watchChanges: true, value: null },
        { label: 'lastname', type: 'String', isReadOnly: false, watchChanges: false },
      ]);
    });

    test('should compute readonly (true) and keep "John" firstname', async () => {
      const fields = await newBooks.getForm(factories.caller.build(), 'make photocopy', {
        firstname: 'John',
      });

      expect(fields).toEqual([
        { label: 'firstname', type: 'String', watchChanges: true, value: 'John' },
        { label: 'lastname', type: 'String', isReadOnly: true, watchChanges: false },
      ]);
    });
  });

  describe.each(['Single', 'Bulk', 'Global'])(
    'with a %s action with a async dynamic form',
    scope => {
      beforeEach(() => {
        newBooks.addAction('make photocopy', {
          scope: scope as ActionScope,
          execute: () => {},
          form: [
            {
              label: 'lastname',
              type: 'String',
              if: () =>
                new Promise(resolve => {
                  setTimeout(() => resolve(true));
                }),
            },
          ],
        });
      });

      test('should be able to compute form', async () => {
        const fields = await newBooks.getForm(factories.caller.build(), 'make photocopy');
        expect(fields).toEqual([
          {
            label: 'lastname',
            type: 'String',
            watchChanges: false,
          },
        ]);
      });
    },
  );
});
