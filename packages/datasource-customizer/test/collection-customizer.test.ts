/* eslint-disable @typescript-eslint/ban-ts-comment */

import {
  ColumnSchema,
  ConditionTreeLeaf,
  MissingFieldError,
  Sort,
} from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import {
  CollectionCustomizationContext,
  CollectionCustomizer,
  ComputedDefinition,
  DataSourceChartDefinition,
  DataSourceCustomizer,
} from '../src';
import { ActionDefinition } from '../src/decorators/actions/types/actions';
import { WriteDefinition } from '../src/decorators/write/write-replace/types';

describe('Builder > Collection', () => {
  const logger = () => {};

  const setup = async () => {
    const dataSource = factories.dataSource.buildWithCollections([
      factories.collection.build({
        name: 'translators',
        schema: factories.collectionSchema.build({
          fields: {
            name: factories.columnSchema.build({
              columnType: 'String',
            }),
            nameInReadOnly: factories.columnSchema.build({
              columnType: 'String',
              isReadOnly: true,
            }),
            authorId: factories.columnSchema.build({
              columnType: 'Number',
            }),
          },
        }),
      }),
      factories.collection.build({
        name: 'authors',
        schema: factories.collectionSchema.build({
          countable: true,
          fields: {
            translator: factories.oneToOneSchema.build({
              foreignCollection: 'translators',
              originKey: 'authorId',
              originKeyTarget: 'authorId',
            }),
            authorId: factories.columnSchema.uuidPrimaryKey().build({
              filterOperators: new Set(['Equal', 'In']),
            }),
            firstName: factories.columnSchema.build({
              isSortable: true,
              filterOperators: new Set(['Equal']),
            }),
            lastName: factories.columnSchema.build({
              filterOperators: new Set(),
            }),
            binary: factories.columnSchema.build({
              columnType: 'Binary',
            }),
          },
        }),
      }),
      factories.collection.build({
        name: 'book_author',
        schema: factories.collectionSchema.build({
          fields: {
            authorFk: factories.columnSchema.uuidPrimaryKey().build({
              filterOperators: new Set(['Equal', 'In']),
            }),
            bookFk: factories.columnSchema.uuidPrimaryKey().build({
              filterOperators: new Set(['Equal', 'In']),
            }),
          },
        }),
      }),
      factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            bookId: factories.columnSchema.uuidPrimaryKey().build({
              filterOperators: new Set(['Equal', 'In']),
            }),
            title: factories.columnSchema.build({ columnType: 'String' }),
          },
        }),
      }),
    ]);

    const dsc = new DataSourceCustomizer();
    dsc.addDataSource(() => Promise.resolve(dataSource));

    // @ts-ignore
    const { stack } = dsc;
    const customizer = new CollectionCustomizer(dsc, stack, 'authors');

    return { dsc, customizer, stack };
  };

  describe('use', () => {
    it('should run the provided code', async () => {
      const { dsc, customizer } = await setup();

      const self = customizer.use(async (_, c) => {
        c.disableCount();
      });

      await dsc.getDataSource(logger);

      expect(self.schema.countable).toBeFalsy();
      expect(self).toEqual(customizer);
    });
  });

  describe('disableCount', () => {
    it('should edit the schema', async () => {
      const { dsc, customizer } = await setup();

      const self = customizer.disableCount();
      await dsc.getDataSource(logger);

      expect(self.schema.countable).toBeFalsy();
      expect(self).toEqual(customizer);
    });
  });

  describe('disableSearch', () => {
    it('should edit the schema', async () => {
      const { dsc, customizer } = await setup();

      const self = customizer.disableSearch();
      await dsc.getDataSource(logger);

      expect(self.schema.searchable).toBeFalsy();
      expect(self).toEqual(customizer);
    });
  });

  describe('renameField', () => {
    it('should throw when renaming with a name including space', async () => {
      const { customizer, dsc } = await setup();

      customizer.renameField('firstName', 'renamed field');

      await expect(() => dsc.getDataSource(logger)).rejects.toThrow(
        `The name of field 'renamed field' you configured on 'authors' must not contain space.` +
          ` Something like 'renamedField' should work has expected.`,
      );
    });

    it('should rename a field', async () => {
      const { dsc, customizer } = await setup();

      const self = customizer.renameField('firstName', 'renamed');
      const dataSource = await dsc.getDataSource(logger);

      expect(self.schema.fields.renamed).toBeUndefined();
      expect(dataSource.getCollection('authors').schema.fields.renamed).toBeDefined();
      expect(self).toEqual(customizer);
    });
  });

  describe('removeField', () => {
    it('should remove the given fields', async () => {
      const { dsc, customizer } = await setup();

      const self = customizer.removeField('firstName', 'lastName');
      const dataSource = await dsc.getDataSource(logger);

      expect(self.schema.fields.firstName).toBeDefined();
      expect(self.schema.fields.lastName).toBeDefined();
      expect(dataSource.getCollection('authors').schema.fields.firstName).toBeUndefined();
      expect(dataSource.getCollection('authors').schema.fields.lastName).toBeUndefined();
      expect(self).toEqual(customizer);
    });
  });

  describe('addAction', () => {
    it('should add an action', async () => {
      const { dsc, customizer } = await setup();

      const actionDefinition: ActionDefinition = { scope: 'Global', execute: () => {} };
      const self = customizer.addAction('action name', actionDefinition);
      await dsc.getDataSource(logger);

      // @ts-ignore
      expect(self.stack.action.getCollection('authors').actions['action name']).toStrictEqual(
        actionDefinition,
      );
      expect(self.schema.actions['action name']).toBeDefined();
      expect(self).toEqual(customizer);
    });
  });

  describe('addChart', () => {
    it('should add a chart', async () => {
      const { dsc, customizer } = await setup();

      const chartDefinition: DataSourceChartDefinition = (ctx, rb) => rb.value(1);
      const self = customizer.addChart('chart name', chartDefinition);
      await dsc.getDataSource(logger);

      // @ts-ignore
      expect(self.stack.chart.getCollection('authors').charts['chart name']).toStrictEqual(
        chartDefinition,
      );
      expect(self.schema.charts).toContain('chart name');
      expect(self).toEqual(customizer);
    });
  });

  describe('addValidation', () => {
    it('should add a validation rule', async () => {
      const { dsc, customizer } = await setup();

      const self = customizer.addFieldValidation('firstName', 'LongerThan', 5);
      await dsc.getDataSource(logger);

      expect((self.schema.fields.firstName as ColumnSchema).validation).toStrictEqual([
        { operator: 'LongerThan', value: 5 },
      ]);
      expect(self).toEqual(customizer);
    });
  });

  describe('importField', () => {
    it('should throw when importing with a name including space', async () => {
      const { customizer, dsc } = await setup();

      customizer.importField('first name copy', { path: 'firstName' });

      await expect(() => dsc.getDataSource(logger)).rejects.toThrow(
        `The name of field 'first name copy' you configured on 'authors' must not contain space.` +
          ` Something like 'firstNameCopy' should work has expected.`,
      );
    });

    it('should call addField', async () => {
      const { dsc, customizer } = await setup();

      const spy = jest.spyOn(customizer, 'addField');
      const self = customizer.importField('firstNameCopy', { path: 'firstName' });
      await dsc.getDataSource(logger);

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstNameCopy', {
        columnType: 'String',
        dependencies: ['firstName'],
        getValues: expect.any(Function),
      });
      expect(self).toEqual(customizer);

      const { getValues } = spy.mock.calls[0][1];
      expect(
        getValues([{ firstName: 'John' }], null as unknown as CollectionCustomizationContext),
      ).toStrictEqual(['John']);
    });

    it('should call the replaceFieldWriting with the correct path', async () => {
      const { dsc, customizer } = await setup();

      const self = customizer.importField('translatorName', { path: 'translator:name' });
      await dsc.getDataSource(logger);

      // @ts-ignore
      expect(self.stack.write.getCollection('authors').handlers.translatorName).toBeDefined();
      expect(self).toEqual(customizer);
    });

    describe('when the field is not writable', () => {
      it('should not call the replaceFieldWriting', async () => {
        const { dsc, customizer } = await setup();

        const self = customizer.importField('translatorName', {
          path: 'translator:nameInReadOnly',
        });
        await dsc.getDataSource(logger);

        // @ts-ignore
        expect(self.stack.write.getCollection('authors').handlers.translatorName).not.toBeDefined();
        expect(self).toEqual(customizer);
      });
    });

    describe('when the "readOnly" option is true', () => {
      it('should not call the replaceFieldWriting', async () => {
        const { dsc, customizer } = await setup();

        const self = customizer.importField('translatorName', {
          path: 'translator:name',
          readonly: true,
        });
        await dsc.getDataSource(logger);

        // @ts-ignore
        expect(self.stack.write.getCollection('authors').handlers.translatorName).not.toBeDefined();
        expect(self).toEqual(customizer);
      });
    });

    describe('when the "readOnly" option is false and the schema doest not allow to write', () => {
      it('should throw an error', async () => {
        const { dsc, customizer } = await setup();
        customizer.importField('translatorName', {
          path: 'translator:nameInReadOnly',
          readonly: false,
        });

        await expect(dsc.getDataSource(logger)).rejects.toThrow(
          'Readonly option should not be false because the field' +
            ' "translator:nameInReadOnly" is not writable',
        );
      });
    });

    describe('when the given field does not exist', () => {
      it('should throw an error', async () => {
        const { dsc, customizer } = await setup();

        customizer.importField('translatorName', { path: 'doesNotExistPath' });
        await expect(dsc.getDataSource(logger)).rejects.toThrow(MissingFieldError);
      });
    });
  });

  describe('addField', () => {
    it('should throw when adding field with a name including space', async () => {
      const { customizer, dsc } = await setup();

      const fieldDefinition: ComputedDefinition = {
        columnType: 'String',
        dependencies: ['firstName'],
        getValues: records => records.map(() => 'aaa'),
      };

      customizer.addField('new field', fieldDefinition);

      await expect(() => dsc.getDataSource(logger)).rejects.toThrow(
        `The name of field 'new field' you configured on 'authors' must not contain space.` +
          ` Something like 'newField' should work has expected.`,
      );
    });

    it('should log a warning when timeonly type is provided', async () => {
      const { customizer, dsc } = await setup();

      const loggerMock = jest.fn();

      const fieldDefinition: ComputedDefinition = {
        columnType: 'Timeonly',
        dependencies: ['firstName'],
        getValues: records => records.map(() => 'aaa'),
      };

      customizer.addField('timeonly_dependency_field', fieldDefinition);

      await expect(dsc.getDataSource(loggerMock)).resolves.not.toThrow();

      expect(loggerMock).toHaveBeenCalledWith(
        'Warn',
        `'Timeonly' is deprecated. Use 'Time' as your columnType instead`,
      );
    });

    it('should log an error when no dependencies are provided', async () => {
      const { customizer, dsc } = await setup();

      const loggerMock = jest.fn();

      // @ts-expect-error
      const fieldDefinition: ComputedDefinition = {
        columnType: 'String',
        getValues: records => records.map(() => 'aaa'),
      };

      customizer.addField('no_dependency_field', fieldDefinition);

      await expect(dsc.getDataSource(loggerMock)).resolves.not.toThrow();

      expect(loggerMock).toHaveBeenCalledWith(
        'Error',
        "Computed field 'authors.no_dependency_field' must have the 'dependencies' parameter defined",
      );
    });

    it('should add a field to early collection', async () => {
      const { dsc, customizer } = await setup();

      const fieldDefinition: ComputedDefinition = {
        columnType: 'String',
        dependencies: ['firstName'],
        getValues: records => records.map(() => 'aaa'),
      };

      const self = customizer.addField('newField', fieldDefinition);
      await dsc.getDataSource(logger);

      expect(self.schema.fields.newField).toBeDefined();
      expect(self).toEqual(customizer);

      // @ts-ignore
      expect(self.stack.lateComputed.getCollection('authors').computeds.newField).not.toBeDefined();

      // @ts-ignore
      const computed = self.stack.earlyComputed.getCollection('authors').computeds.newField;
      expect(computed).toBeDefined();

      expect(
        computed.getValues(
          [{ firstName: 'John' }],
          null as unknown as CollectionCustomizationContext,
        ),
      ).toStrictEqual(['aaa']);
    });

    it('should add a field to late collection', async () => {
      const { dsc, customizer } = await setup();

      // Add a relation to itself on the record
      customizer.addManyToOneRelation('mySelf', 'authors', {
        foreignKey: 'authorId',
        foreignKeyTarget: 'authorId',
      });

      const fieldDefinition: ComputedDefinition = {
        columnType: 'String',
        dependencies: ['firstName', 'mySelf:firstName'],
        getValues: records => records.map(() => 'aaa'),
      };

      const self = customizer.addField('newField', fieldDefinition);
      await dsc.getDataSource(logger);

      expect(self.schema.fields.newField).toBeDefined();
      expect(self).toEqual(customizer);

      expect(
        // @ts-ignore
        self.stack.earlyComputed.getCollection('authors').computeds.newField,
      ).not.toBeDefined();
      // @ts-ignore
      const computed = self.stack.lateComputed.getCollection('authors').computeds.newField;
      expect(computed).toBeDefined();

      expect(
        computed.getValues(
          [{ firstName: 'John' }],
          null as unknown as CollectionCustomizationContext,
        ),
      ).toStrictEqual(['aaa']);
    });
  });

  describe('addExternalRelation', () => {
    it('should call addField', async () => {
      const { dsc, customizer } = await setup();

      const spy = jest.spyOn(customizer, 'addField');
      const self = customizer.addExternalRelation('firstNameCopy', {
        schema: { firstname: 'String', lastName: 'String' },
        listRecords: () => {
          return [{ firstname: 'John', lastName: 'Doe' }];
        },
      });
      await dsc.getDataSource(logger);

      expect(spy).toHaveBeenCalledWith('firstNameCopy', {
        columnType: [{ firstname: 'String', lastName: 'String' }],
        dependencies: ['authorId'],
        getValues: expect.any(Function),
      });
      expect(self).toEqual(customizer);

      const { getValues } = spy.mock.calls[0][1];
      const values = await Promise.all(
        await getValues(
          [{ authorId: 1 }, { authorId: 2 }],
          null as unknown as CollectionCustomizationContext,
        ),
      );
      expect(values).toStrictEqual([
        [{ firstname: 'John', lastName: 'Doe' }],
        [{ firstname: 'John', lastName: 'Doe' }],
      ]);
    });
  });

  describe('relations', () => {
    it('should add a many to one', async () => {
      const { dsc, stack } = await setup();
      const customizer = new CollectionCustomizer(dsc, stack, 'book_author');

      const self = customizer.addManyToOneRelation('myAuthor', 'authors', {
        foreignKey: 'authorFk',
        foreignKeyTarget: 'authorId',
      });
      await dsc.getDataSource(logger);

      // @ts-ignore
      expect(self.stack.relation.getCollection('book_author').relations.myAuthor).toStrictEqual({
        type: 'ManyToOne',
        foreignCollection: 'authors',
        foreignKey: 'authorFk',
        foreignKeyTarget: 'authorId',
      });
      expect(self.schema.fields.myAuthor).toBeDefined();
      expect(self).toEqual(customizer);
    });

    it('should add a one to one', async () => {
      const { dsc, customizer } = await setup();

      const self = customizer.addOneToOneRelation('myBookAuthor', 'book_author', {
        originKey: 'authorFk',
        originKeyTarget: 'authorId',
      });
      await dsc.getDataSource(logger);

      // @ts-ignore
      expect(self.stack.relation.getCollection('authors').relations.myBookAuthor).toStrictEqual({
        type: 'OneToOne',
        foreignCollection: 'book_author',
        originKey: 'authorFk',
        originKeyTarget: 'authorId',
      });
      expect(self.schema.fields.myBookAuthor).toBeDefined();
      expect(self).toEqual(customizer);
    });

    it('should add a one to many', async () => {
      const { dsc, customizer } = await setup();

      const self = customizer.addOneToManyRelation('myBookAuthors', 'book_author', {
        originKey: 'authorFk',
        originKeyTarget: 'authorId',
      });
      await dsc.getDataSource(logger);

      // @ts-ignore
      expect(self.stack.relation.getCollection('authors').relations.myBookAuthors).toStrictEqual({
        type: 'OneToMany',
        foreignCollection: 'book_author',
        originKey: 'authorFk',
        originKeyTarget: 'authorId',
      });
      expect(self.schema.fields.myBookAuthors).toBeDefined();
      expect(self).toEqual(customizer);
    });

    it('should add a many to many', async () => {
      const { dsc, customizer } = await setup();

      const self = customizer.addManyToManyRelation('myBooks', 'books', 'book_author', {
        foreignKey: 'bookFk',
        foreignKeyTarget: 'bookId',
        originKey: 'authorFk',
        originKeyTarget: 'authorId',
      });
      await dsc.getDataSource(logger);

      // @ts-ignore
      expect(self.stack.relation.getCollection('authors').relations.myBooks).toStrictEqual({
        type: 'ManyToMany',
        foreignCollection: 'books',
        throughCollection: 'book_author',
        foreignKey: 'bookFk',
        foreignKeyTarget: 'bookId',
        originKey: 'authorFk',
        originKeyTarget: 'authorId',
      });
      expect(self.schema.fields.myBooks).toBeDefined();
      expect(self).toEqual(customizer);
    });

    it('should not allow disableFieldSorting', async () => {
      const { dsc, customizer } = await setup();

      const self = customizer.addOneToOneRelation('myBookAuthor', 'book_author', {
        originKey: 'authorFk',
        originKeyTarget: 'authorId',
      });

      customizer.disableFieldSorting('myBookAuthor');

      await expect(() => dsc.getDataSource(logger)).rejects.toThrow(
        new Error(
          "Unexpected field type: 'authors.myBookAuthor' (found 'OneToOne' expected 'Column')",
        ),
      );

      // @ts-ignore
      expect(self.stack.relation.getCollection('authors').relations.myBookAuthor).toStrictEqual({
        type: 'OneToOne',
        foreignCollection: 'book_author',
        originKey: 'authorFk',
        originKeyTarget: 'authorId',
      });
      expect(self.schema.fields.myBookAuthor).toBeDefined();
      expect(self).toEqual(customizer);
    });

    it('should not allow replaceFieldSorting', async () => {
      const { dsc, customizer } = await setup();

      const self = customizer.addOneToOneRelation('myBookAuthor', 'book_author', {
        originKey: 'authorFk',
        originKeyTarget: 'authorId',
      });

      customizer.replaceFieldSorting('myBookAuthor', []);

      await expect(() => dsc.getDataSource(logger)).rejects.toThrow(
        new Error(
          "Unexpected field type: 'authors.myBookAuthor' (found 'OneToOne' expected 'Column')",
        ),
      );

      // @ts-ignore
      expect(self.stack.relation.getCollection('authors').relations.myBookAuthor).toStrictEqual({
        type: 'OneToOne',
        foreignCollection: 'book_author',
        originKey: 'authorFk',
        originKeyTarget: 'authorId',
      });
      expect(self.schema.fields.myBookAuthor).toBeDefined();
      expect(self).toEqual(customizer);
    });
  });

  describe('addSegment', () => {
    it('should add a segment', async () => {
      const { dsc, customizer } = await setup();

      const generator = async () => new ConditionTreeLeaf('fieldName', 'Present');

      const self = customizer.addSegment('new segment', generator);
      await dsc.getDataSource(logger);

      // @ts-ignore
      expect(self.stack.segment.getCollection('authors').segments['new segment']).toStrictEqual(
        generator,
      );
      expect(self.schema.segments).toEqual(expect.arrayContaining(['new segment']));
      expect(self).toEqual(customizer);
    });
  });

  describe('disableFieldSorting', () => {
    it('should disable sort on field', async () => {
      const { dsc, customizer } = await setup();

      const self = customizer.disableFieldSorting('firstName');
      await dsc.getDataSource(logger);

      expect(
        // @ts-ignore
        self.stack.sortEmulate.getCollection('authors').disabledSorts.has('firstName'),
      ).toBeTrue();
      expect(self).toEqual(customizer);
    });
  });

  describe('emulateFieldSorting', () => {
    it('should emulate sort on field', async () => {
      const { dsc, customizer } = await setup();

      const self = customizer.emulateFieldSorting('firstName');
      await dsc.getDataSource(logger);

      // @ts-ignore
      expect(self.stack.sortEmulate.getCollection('authors').sorts.has('firstName')).toBeTrue();
      expect(self).toEqual(customizer);
    });
  });

  describe('replaceFieldSorting', () => {
    it('should replace sort on field', async () => {
      const { dsc, customizer } = await setup();

      const sortClauses = [{ field: 'firstName', ascending: true }];
      const self = customizer.replaceFieldSorting('firstName', sortClauses);
      await dsc.getDataSource(logger);

      // @ts-ignore
      expect(self.stack.sortEmulate.getCollection('authors').sorts.get('firstName')).toStrictEqual(
        new Sort(...sortClauses),
      );
      expect(self).toEqual(customizer);
    });
  });

  describe('replaceFieldWriting', () => {
    it('should replace write on field', async () => {
      const { dsc, customizer } = await setup();

      const definition: WriteDefinition = jest.fn();
      const self = customizer.replaceFieldWriting('firstName', definition);
      await dsc.getDataSource(logger);

      // @ts-ignore
      expect(self.stack.write.getCollection('authors').handlers.firstName).toStrictEqual(
        definition,
      );
      expect(self).toEqual(customizer);
    });
  });

  describe('emulateFieldFiltering', () => {
    it('should emulate operator on field', async () => {
      const { dsc, customizer } = await setup();

      const self = customizer.emulateFieldFiltering('lastName');
      await dsc.getDataSource(logger);

      expect(
        // @ts-ignore
        self.stack.earlyOpEmulate.getCollection('authors').fields.get('lastName'),
      ).toStrictEqual(
        new Map(
          [
            'Equal',
            'NotEqual',
            'Present',
            'Blank',
            'In',
            'NotIn',
            'StartsWith',
            'EndsWith',
            'IStartsWith',
            'IEndsWith',
            'Contains',
            'NotContains',
            'IContains',
            'NotIContains',
            'Missing',
            'Like',
            'ILike',
            'LongerThan',
            'ShorterThan',
            'IncludesAll',
            'IncludesNone',
          ].map(k => [k, null]),
        ),
      );
      expect(self).toEqual(customizer);
    });
  });

  describe('emulateFieldOperator', () => {
    it('should emulate operator on field', async () => {
      const { dsc, customizer } = await setup();

      const self = customizer.emulateFieldOperator('firstName', 'Present');
      await dsc.getDataSource(logger);

      expect(
        // @ts-ignore
        self.stack.earlyOpEmulate.getCollection('authors').fields.get('firstName').get('Present'),
      ).not.toBeUndefined();
      expect(self).toEqual(customizer);
    });
  });

  describe('replaceFieldOperator', () => {
    it('should replace operator on field', async () => {
      const { dsc, customizer } = await setup();

      const replacer = async () => new ConditionTreeLeaf('fieldName', 'NotEqual', null);

      const self = customizer.replaceFieldOperator('firstName', 'Present', replacer);
      await dsc.getDataSource(logger);

      expect(
        // @ts-ignore
        self.stack.earlyOpEmulate.getCollection('authors').fields.get('firstName').get('Present'),
      ).toStrictEqual(replacer);
      expect(self).toEqual(customizer);
    });
  });

  describe('replaceFieldBinaryMode', () => {
    it('should replace binary mode on field', async () => {
      const { dsc, customizer } = await setup();

      const self = customizer.replaceFieldBinaryMode('binary', 'hex');
      await dsc.getDataSource(logger);

      // @ts-ignore
      expect(self.stack.binary.getCollection('authors').useHexConversion.get('binary')).toBeTrue();
      expect(self).toEqual(customizer);
    });
  });

  describe('replaceSearch', () => {
    it('should call the search decorator', async () => {
      const { dsc, customizer } = await setup();

      const replacer = async search =>
        ({ field: 'firstName', operator: 'Equal', value: search } as const);

      const self = customizer.replaceSearch(replacer);
      await dsc.getDataSource(logger);

      // @ts-ignore
      expect(self.stack.search.getCollection('authors').replacer).toStrictEqual(replacer);
      expect(self).toEqual(customizer);
    });
  });

  describe('addHook', () => {
    it('should call the hook decorator', async () => {
      const { dsc, customizer } = await setup();

      const hookHandler = () => {};

      const self = customizer.addHook('Before', 'List', hookHandler);
      await dsc.getDataSource(logger);

      // @ts-ignore
      expect(self.stack.hook.getCollection('authors').hooks.List.before).toStrictEqual([
        hookHandler,
      ]);
      expect(self).toEqual(customizer);
    });
  });

  describe('overrideCreate', () => {
    it('should add the handler to the stack', async () => {
      const { dsc, customizer } = await setup();

      const handler = async () => [];

      const self = customizer.overrideCreate(handler);
      await dsc.getDataSource(logger);

      // @ts-ignore
      expect(self.stack.override.getCollection('authors').createHandler).toStrictEqual(handler);
      expect(self).toEqual(customizer);
    });
  });

  describe('overrideUpdate', () => {
    it('should add the handler to the stack', async () => {
      const { dsc, customizer } = await setup();

      const handler = async () => {};

      const self = customizer.overrideUpdate(handler);
      await dsc.getDataSource(logger);

      // @ts-ignore
      expect(self.stack.override.getCollection('authors').updateHandler).toStrictEqual(handler);
      expect(self).toEqual(customizer);
    });
  });

  describe('overrideDelete', () => {
    it('should add the handler to the stack', async () => {
      const { dsc, customizer } = await setup();

      const handler = async () => {};

      const self = customizer.overrideDelete(handler);
      await dsc.getDataSource(logger);

      // @ts-ignore
      expect(self.stack.override.getCollection('authors').deleteHandler).toStrictEqual(handler);
      expect(self).toEqual(customizer);
    });
  });
});
