import {
  ActionScope,
  Collection,
  DataSource,
  DataSourceDecorator,
  File,
  Filter,
} from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import ActionCollection from '../../../src/decorators/actions/collection';
import ActionContextSingle from '../../../src/decorators/actions/context/single';
import { DynamicField } from '../../../src/decorators/actions/types/fields';
import { TSchema } from '../../../src/templates';

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
        {
          id: 'firstname',
          label: 'firstname',
          type: 'String',
          watchChanges: false,
        },
        { id: 'lastname', label: 'lastname', type: 'String', watchChanges: false },
      ]);
    });
  });

  describe('with single action with ifs', () => {
    beforeEach(() => {
      newBooks.addAction('make photocopy', {
        scope: 'Single',
        execute: () => {},
        form: [
          {
            label: 'noIf',
            type: 'String',
          },
          {
            label: 'dynamicIfFalse',
            type: 'String',
            if: () => false,
          },
          {
            label: 'dynamicIfTrue',
            type: 'String',
            if: () => true,
          },
        ],
      });
    });

    test('should dropIfs which are false if required', async () => {
      const fields = await newBooks.getForm(
        factories.caller.build(),
        'make photocopy',
        undefined,
        undefined,
        { includeHiddenFields: false },
      );

      expect(fields).toEqual([
        expect.objectContaining({
          label: 'noIf',
          type: 'String',
        }),
        expect.objectContaining({
          label: 'dynamicIfTrue',
          type: 'String',
        }),
      ]);
    });

    test('should not dropIfs if required', async () => {
      const fields = await newBooks.getForm(
        factories.caller.build(),
        'make photocopy',
        undefined,
        undefined,
        { includeHiddenFields: true },
      );

      expect(fields).toEqual([
        expect.objectContaining({
          label: 'noIf',
          type: 'String',
        }),
        expect.objectContaining({
          label: 'dynamicIfFalse',
          type: 'String',
        }),
        expect.objectContaining({
          label: 'dynamicIfTrue',
          type: 'String',
        }),
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
          id: 'firstname',
          label: 'firstname',
          type: 'String',
          watchChanges: true,
          value: 'DynamicDefault',
        },
        {
          id: 'lastname',
          label: 'lastname',
          type: 'String',
          isReadOnly: true,
          watchChanges: false,
        },
      ]);
    });

    test('should compute dynamic default value on added field', async () => {
      const fields = await newBooks.getForm(factories.caller.build(), 'make photocopy', {
        lastname: 'value',
      });

      expect(fields).toEqual([
        {
          id: 'firstname',
          label: 'firstname',
          type: 'String',
          watchChanges: true,
          value: 'DynamicDefault',
        },
        {
          id: 'lastname',
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
        { id: 'firstname', label: 'firstname', type: 'String', watchChanges: true, value: null },
        {
          id: 'lastname',
          label: 'lastname',
          type: 'String',
          isReadOnly: false,
          watchChanges: false,
        },
      ]);
    });

    test('should compute readonly (true) and keep "John" firstname', async () => {
      const fields = await newBooks.getForm(factories.caller.build(), 'make photocopy', {
        firstname: 'John',
      });

      expect(fields).toEqual([
        { id: 'firstname', label: 'firstname', type: 'String', watchChanges: true, value: 'John' },
        {
          id: 'lastname',
          label: 'lastname',
          type: 'String',
          isReadOnly: true,
          watchChanges: false,
        },
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
          { changedField: 'firstname', searchField },
        );

        expect(fields).toEqual([
          {
            id: 'firstname',
            label: 'firstname',
            type: 'String',
            watchChanges: true,
            value: 'John',
          },
          {
            id: 'lastname',
            label: 'lastname',
            type: 'String',
            isReadOnly: true,
            watchChanges: false,
          },
        ]);
      });
    });
  });

  describe('with single action with dynamic form', () => {
    beforeEach(() => {
      newBooks.addAction('make photocopy', {
        scope: 'Single',
        execute: (context, resultBuilder) => {
          return resultBuilder.error('meeh');
        },
        form: async <Context extends ActionContextSingle<TSchema, string>>(
          formContext: Context,
        ): Promise<DynamicField<Context>[]> => {
          return Object.entries(formContext.collection.schema.fields)
            .map(([fieldName, field]) =>
              field.type === 'Column'
                ? {
                    label: fieldName,
                    type: field.columnType,
                  }
                : undefined,
            )
            .filter(field => field !== undefined) as DynamicField<Context>[];
        },
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

      expect(fields).toHaveLength(2);
      expect(fields).toEqual([
        {
          id: 'id',
          label: 'id',
          type: 'String',
          watchChanges: false,
          value: undefined,
        },
        { id: 'title', label: 'title', type: 'String', watchChanges: false, value: undefined },
      ]);
    });

    test('should compute dynamic default value on added field', async () => {
      const fields = await newBooks.getForm(factories.caller.build(), 'make photocopy', {
        title: 'value',
      });

      expect(fields).toEqual([
        {
          id: 'id',
          label: 'id',
          type: 'String',
          watchChanges: false,
          value: undefined,
        },
        {
          id: 'title',
          label: 'title',
          type: 'String',
          value: 'value',
          watchChanges: false,
        },
      ]);
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
          searchValues: { firstName: 'first' },
        },
      );
      expect(fields).toEqual([
        {
          id: 'firstname',
          label: 'firstname',
          type: 'String',
          value: 'DynamicDefault',
          watchChanges: false,
        },
      ]);
    });
  });

  describe('File type', () => {
    describe('with single action with File type and hardcoded defaultValue', () => {
      beforeEach(() => {
        newBooks.addAction('make photocopy', {
          scope: 'Single',
          execute: () => {},
          form: [
            {
              label: 'firstname',
              type: 'File',
              defaultValue: 'hello' as unknown as File,
            },
          ],
        });
      });

      test('should mark the action as dynamic', async () => {
        expect(newBooks.schema.actions['make photocopy']).toEqual({
          scope: 'Single',
          generateFile: false,
          staticForm: false,
        });
      });
    });

    describe('with single action with File type and function defaultValue', () => {
      beforeEach(() => {
        newBooks.addAction('make photocopy', {
          scope: 'Single',
          execute: () => {},
          form: [
            {
              label: 'firstname',
              type: 'File',
              defaultValue: 'hello' as unknown as File,
            },
          ],
        });
      });

      test('should mark the action as dynamic', async () => {
        expect(newBooks.schema.actions['make photocopy']).toEqual({
          scope: 'Single',
          generateFile: false,
          staticForm: false,
        });
      });
    });

    describe('with single action with String type and hardcoded defaultValue', () => {
      beforeEach(() => {
        newBooks.addAction('make photocopy', {
          scope: 'Single',
          execute: () => {},
          form: [
            {
              label: 'firstname',
              type: 'String',
              defaultValue: 'hello',
            },
          ],
        });
      });

      test('should mark the action as static', async () => {
        expect(newBooks.schema.actions['make photocopy']).toEqual({
          scope: 'Single',
          generateFile: false,
          staticForm: true,
        });
      });
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
            id: 'lastname',
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
        {
          changedField: '',
          searchField: 'dynamic search',
          searchValues: { 'dynamic search': '123' },
        },
      );
      expect(fields).toStrictEqual([
        {
          id: 'dynamic search',
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
          id: 'change',
          label: 'change',
          type: 'String',
          watchChanges: true,
        },
        {
          id: 'to change',
          label: 'to change',
          type: 'String',
          isReadOnly: true,
          watchChanges: false,
        },
      ]);
    });
  });

  describe('with a form with layout elements', () => {
    test('should be flagged as dynamic form', () => {
      newBooks.addAction('make photocopy', {
        scope: 'Single',
        execute: (context, resultBuilder) => {
          return resultBuilder.error('meeh');
        },
        form: [
          { label: 'firstname', type: 'String' },
          { type: 'Layout', component: 'Separator' },
          { label: 'lastname', type: 'String' },
        ],
      });

      expect(newBooks.schema.actions['make photocopy']).toEqual({
        scope: 'Single',
        generateFile: false,
        staticForm: false,
      });
    });

    test('should compute the form recursively', async () => {
      newBooks.addAction('make photocopy', {
        scope: 'Single',
        execute: (context, resultBuilder) => {
          return resultBuilder.error('meeh');
        },
        form: [
          {
            type: 'Layout',
            component: 'Row',
            fields: [
              { label: 'firstname', type: 'String' },
              { label: 'lastname', type: 'String' },
            ],
          },
          { type: 'Layout', component: 'Separator' },
          { label: 'age', type: 'Number' },
          { id: 'id-age', label: 'age', type: 'Number' },
          {
            type: 'Layout',
            component: 'Row',
            fields: [
              { label: 'tel', type: 'Number', if: ctx => ctx.formValues.age > 18 },
              {
                label: 'email',
                type: 'String',
                defaultValue: ctx => `${ctx.formValues.firstname}.${ctx.formValues.lastname}@`,
              },
            ],
          },
        ],
      });

      expect(await newBooks.getForm(null, 'make photocopy', null, null)).toEqual([
        {
          component: 'Row',
          fields: [
            {
              id: 'firstname',
              label: 'firstname',
              type: 'String',
              value: undefined,
              watchChanges: true,
            },
            {
              id: 'lastname',
              label: 'lastname',
              type: 'String',
              value: undefined,
              watchChanges: true,
            },
          ],
          type: 'Layout',
        },
        { component: 'Separator', type: 'Layout' },
        { id: 'age', label: 'age', type: 'Number', value: undefined, watchChanges: true },
        { id: 'id-age', label: 'age', type: 'Number', value: undefined, watchChanges: false },
        {
          component: 'Row',
          fields: [
            {
              id: 'email',
              label: 'email',
              type: 'String',
              value: 'undefined.undefined@',
              watchChanges: false,
            },
          ],
          type: 'Layout',
        },
      ]);

      expect(
        await newBooks.getForm(null, 'make photocopy', { age: 25, lastname: 'smith' }, null),
      ).toEqual(
        expect.arrayContaining([
          { id: 'age', label: 'age', type: 'Number', value: 25, watchChanges: true },
          {
            component: 'Row',
            fields: [
              { id: 'tel', label: 'tel', type: 'Number', value: undefined, watchChanges: false },
              {
                id: 'email',
                label: 'email',
                type: 'String',
                value: 'undefined.smith@',
                watchChanges: false,
              },
            ],
            type: 'Layout',
          },
        ]),
      );
    });

    describe('with pages', () => {
      test('should compute the form recursively', async () => {
        newBooks.addAction('make photocopy', {
          scope: 'Single',
          execute: (context, resultBuilder) => {
            return resultBuilder.error('meeh');
          },
          form: [
            {
              type: 'Layout',
              component: 'Page',
              elements: [
                {
                  type: 'Layout',
                  component: 'Row',
                  fields: [
                    { label: 'firstname', type: 'String' },
                    { label: 'lastname', type: 'String' },
                  ],
                },
              ],
            },
            {
              type: 'Layout',
              component: 'Page',
              elements: [
                { type: 'Layout', component: 'Separator' },
                { label: 'age', type: 'Number' },
              ],
            },
            {
              type: 'Layout',
              component: 'Page',
              elements: [
                { id: 'id-age', label: 'age', type: 'Number' },
                {
                  type: 'Layout',
                  component: 'Row',
                  fields: [
                    { label: 'tel', type: 'Number', if: ctx => ctx.formValues.age > 18 },
                    {
                      label: 'email',
                      type: 'String',
                      defaultValue: ctx =>
                        `${ctx.formValues.firstname}.${ctx.formValues.lastname}@`,
                    },
                  ],
                },
              ],
            },
          ],
        });

        expect(await newBooks.getForm(null, 'make photocopy', null, null)).toEqual([
          {
            type: 'Layout',
            component: 'Page',
            elements: [
              {
                component: 'Row',
                fields: [
                  {
                    id: 'firstname',
                    label: 'firstname',
                    type: 'String',
                    value: undefined,
                    watchChanges: true,
                  },
                  {
                    id: 'lastname',
                    label: 'lastname',
                    type: 'String',
                    value: undefined,
                    watchChanges: true,
                  },
                ],
                type: 'Layout',
              },
            ],
          },
          {
            type: 'Layout',
            component: 'Page',
            elements: [
              { component: 'Separator', type: 'Layout' },
              { id: 'age', label: 'age', type: 'Number', value: undefined, watchChanges: true },
            ],
          },
          {
            type: 'Layout',
            component: 'Page',
            elements: [
              { id: 'id-age', label: 'age', type: 'Number', value: undefined, watchChanges: false },
              {
                component: 'Row',
                fields: [
                  {
                    id: 'email',
                    label: 'email',
                    type: 'String',
                    value: 'undefined.undefined@',
                    watchChanges: false,
                  },
                ],
                type: 'Layout',
              },
            ],
          },
        ]);

        expect(
          await newBooks.getForm(null, 'make photocopy', { age: 25, lastname: 'smith' }, null),
        ).toEqual([
          {
            type: 'Layout',
            component: 'Page',
            elements: [
              {
                component: 'Row',
                fields: [
                  {
                    id: 'firstname',
                    label: 'firstname',
                    type: 'String',
                    value: undefined,
                    watchChanges: true,
                  },
                  {
                    id: 'lastname',
                    label: 'lastname',
                    type: 'String',
                    value: 'smith',
                    watchChanges: true,
                  },
                ],
                type: 'Layout',
              },
            ],
          },
          {
            type: 'Layout',
            component: 'Page',
            elements: [
              { component: 'Separator', type: 'Layout' },
              { id: 'age', label: 'age', type: 'Number', value: 25, watchChanges: true },
            ],
          },
          {
            type: 'Layout',
            component: 'Page',
            elements: [
              {
                id: 'id-age',
                label: 'age',
                type: 'Number',
                value: undefined,
                watchChanges: false,
              },
              {
                component: 'Row',
                fields: [
                  {
                    id: 'tel',
                    label: 'tel',
                    type: 'Number',
                    value: undefined,
                    watchChanges: false,
                  },
                  {
                    id: 'email',
                    label: 'email',
                    type: 'String',
                    value: 'undefined.smith@',
                    watchChanges: false,
                  },
                ],
                type: 'Layout',
              },
            ],
          },
        ]);
      });

      test('should throw if there is pages in a single page form', async () => {
        newBooks.addAction('make photocopy', {
          scope: 'Single',
          execute: (context, resultBuilder) => {
            return resultBuilder.error('meeh');
          },
          form: [
            { label: 'age', type: 'Number' },
            {
              type: 'Layout',
              component: 'Page',
              elements: [{ label: 'firstname', type: 'String' }],
            },
          ],
        });

        await expect(async () =>
          newBooks.getForm(null, 'make photocopy', null, null),
        ).rejects.toThrow(
          new Error('Single page forms cannot have pages as root elements of the form array'),
        );
      });

      test('should throw if there is other elements than pages in a multipages form', async () => {
        newBooks.addAction('make photocopy', {
          scope: 'Single',
          execute: (context, resultBuilder) => {
            return resultBuilder.error('meeh');
          },
          form: [
            {
              type: 'Layout',
              component: 'Page',
              elements: [{ label: 'firstname', type: 'String' }],
            },
            { label: 'age', type: 'Number' },
          ],
        });

        await expect(async () =>
          newBooks.getForm(null, 'make photocopy', null, null),
        ).rejects.toThrow(
          new Error('Multipages forms can only have pages as root elements of the form array'),
        );
      });
    });
  });
});
