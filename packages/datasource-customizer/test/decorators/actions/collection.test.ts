import {
  ActionScope,
  Collection,
  DataSource,
  DataSourceDecorator,
  Filter,
} from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import ActionCollection from '../../../src/decorators/actions/collection';

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
      const metas = { changedField: 'a field' };
      const fields = await newBooks.getForm(
        caller,
        'someAction',
        { firstname: 'John' },
        filter,
        metas,
      );

      expect(fields).toEqual([]);
      expect(books.getForm).toHaveBeenCalledWith(
        caller,
        'someAction',
        { firstname: 'John' },
        filter,
        metas,
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
        undefined,
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
      const fields = await newBooks.getForm(factories.caller.build(), 'make photocopy', undefined);

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

    test('should compute dynamic default value on added field', async () => {
      const fields = await newBooks.getForm(factories.caller.build(), 'make photocopy', {
        lastname: 'value',
      });

      expect(fields).toEqual([
        {
          label: 'firstname',
          type: 'String',
          watchChanges: true,
          value: 'DynamicDefault',
        },
        {
          label: 'lastname',
          type: 'String',
          value: 'value',
          isReadOnly: true,
          watchChanges: false,
        },
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

    describe.each([null, undefined])('with a %s searchField', searchField => {
      test('it should compute all fields', async () => {
        const fields = await newBooks.getForm(
          factories.caller.build(),
          'make photocopy',
          {
            firstname: 'John',
          },
          undefined,
          { changedField: 'firstname', searchValue: null, searchField },
        );

        expect(fields).toEqual([
          { label: 'firstname', type: 'String', watchChanges: true, value: 'John' },
          { label: 'lastname', type: 'String', isReadOnly: true, watchChanges: false },
        ]);
      });
    });
  });
  describe('with single action with search hook', () => {
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
    test('should only return the field matching the searchField', async () => {
      const fields = await newBooks.getForm(
        factories.caller.build(),
        'make photocopy',
        undefined,
        undefined,
        {
          changedField: 'toto',
          searchField: 'firstname',
          searchValue: 'first',
        },
      );
      expect(fields).toEqual([
        {
          label: 'firstname',
          type: 'String',
          value: 'DynamicDefault',
          watchChanges: false,
        },
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
  describe('searchField', () => {
    test(`it should pass and use the context and searchField in the options handler`, async () => {
      newBooks.addAction('make photocopy', {
        scope: 'Single',
        execute: () => {},
        form: [
          {
            label: 'default',
            type: 'String',
            defaultValue: 'hello',
            value: 'hello',
          },
          {
            label: 'dynamic search',
            type: 'String',
            widget: 'Dropdown',
            search: 'dynamic',
            options: (context, searchValue) => {
              return [searchValue, context.caller.email];
            },
          },
        ],
      });

      const fields = await newBooks.getForm(
        factories.caller.build(),
        'make photocopy',
        {},
        undefined,
        { changedField: '', searchField: 'dynamic search', searchValue: '123' },
      );
      expect(fields).toStrictEqual([
        {
          label: 'dynamic search',
          type: 'String',
          options: expect.arrayContaining(['123', 'user@domain.com']),
          search: 'dynamic',
          value: undefined,
          watchChanges: false,
          widget: 'Dropdown',
        },
      ]);
    });
  });

  describe('changedField', () => {
    test(`should log warning on changedField usage`, async () => {
      newBooks.addAction('make photocopy', {
        scope: 'Single',
        execute: (context, resultBuilder) => {
          return resultBuilder.error('meeh');
        },
        form: [
          {
            label: 'change',
            type: 'String',
          },
          {
            label: 'to change',
            type: 'String',
            isReadOnly: true,
            value: context => {
              if (context.changedField === 'change') {
                return context.formValues.change;
              }
            },
          },
        ],
      });

      const logSpy = jest.spyOn(console, 'warn');

      await newBooks.getForm(factories.caller.build(), 'make photocopy');
      expect(logSpy).toHaveBeenCalledWith(
        '\x1b[33mwarning:\x1b[0m',
        'Usage of `changedField` is deprecated, please use `hasFieldChanged` instead.',
      );
    });
  });

  describe('hasFieldChanged', () => {
    // eslint-disable-next-line max-len
    test(`should add watchChange property to fields that need to trigger a recompute on change`, async () => {
      newBooks.addAction('make photocopy', {
        scope: 'Single',
        execute: (context, resultBuilder) => {
          return resultBuilder.error('meeh');
        },
        form: [
          {
            label: 'change',
            type: 'String',
          },
          {
            label: 'to change',
            type: 'String',
            isReadOnly: true,
            value: context => {
              if (context.hasFieldChanged('change')) {
                return context.formValues.change;
              }
            },
          },
        ],
      });

      const fields = await newBooks.getForm(factories.caller.build(), 'make photocopy');
      expect(fields).toEqual([
        {
          label: 'change',
          type: 'String',
          watchChanges: true,
        },
        {
          label: 'to change',
          type: 'String',
          isReadOnly: true,
          watchChanges: false,
        },
      ]);
    });
  });
});
