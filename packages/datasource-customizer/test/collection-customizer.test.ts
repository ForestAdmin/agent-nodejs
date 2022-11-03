/* eslint-disable @typescript-eslint/ban-ts-comment */

import { ColumnSchema, ConditionTreeLeaf, Sort } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import {
  CollectionCustomizationContext,
  CollectionCustomizer,
  ComputedDefinition,
  DataSourceChartDefinition,
  DataSourceCustomizer,
} from '../src';
import { ActionDefinition } from '../src/decorators/actions/types/actions';
import { WriteDefinition } from '../src/decorators/write/types';

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
    await dsc.getDataSource(logger);

    // @ts-ignore
    const { stack } = dsc;
    const customizer = new CollectionCustomizer(dsc, stack, 'authors');

    return { dsc, stack, customizer };
  };

  describe('use', () => {
    it('should run the provided code', async () => {
      const { dsc, customizer, stack } = await setup();
      const spy = jest.spyOn(stack.schema.getCollection('authors'), 'overrideSchema');

      const self = customizer.use(async (_, c) => {
        c.disableCount();
      });

      await dsc.getDataSource(logger);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({ countable: false });
      expect(self.schema.countable).toBeFalsy();
      expect(self).toEqual(customizer);
    });
  });

  describe('disableCount', () => {
    it('should edit the schema', async () => {
      const { dsc, customizer, stack } = await setup();
      const spy = jest.spyOn(stack.schema.getCollection('authors'), 'overrideSchema');

      const self = customizer.disableCount();
      await dsc.getDataSource(logger);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({ countable: false });
      expect(self.schema.countable).toBeFalsy();
      expect(self).toEqual(customizer);
    });
  });

  describe('renameField', () => {
    it('should rename a field', async () => {
      const { dsc, customizer, stack } = await setup();
      const spy = jest.spyOn(stack.renameField.getCollection('authors'), 'renameField');

      const self = customizer.renameField('firstName', 'renamed');
      const dataSource = await dsc.getDataSource(logger);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName', 'renamed');
      expect(self.schema.fields.renamed).toBeUndefined();
      expect(dataSource.getCollection('authors').schema.fields.renamed).toBeDefined();
      expect(self).toEqual(customizer);
    });
  });

  describe('removeField', () => {
    it('should remove the field given fields', async () => {
      const { dsc, customizer, stack } = await setup();
      const spy = jest.spyOn(stack.publication.getCollection('authors'), 'changeFieldVisibility');

      const self = customizer.removeField('firstName', 'lastName');
      const dataSource = await dsc.getDataSource(logger);

      expect(spy).toBeCalledTimes(2);
      expect(spy).toHaveBeenNthCalledWith(1, 'firstName', false);
      expect(spy).toHaveBeenNthCalledWith(2, 'lastName', false);
      expect(self.schema.fields.firstName).toBeDefined();
      expect(self.schema.fields.lastName).toBeDefined();
      expect(dataSource.getCollection('authors').schema.fields.firstName).toBeUndefined();
      expect(dataSource.getCollection('authors').schema.fields.lastName).toBeUndefined();
      expect(self).toEqual(customizer);
    });
  });

  describe('addAction', () => {
    it('should add an action', async () => {
      const { dsc, customizer, stack } = await setup();
      const spy = jest.spyOn(stack.action.getCollection('authors'), 'addAction');

      const actionDefinition: ActionDefinition = { scope: 'Global', execute: () => {} };
      const self = customizer.addAction('action name', actionDefinition);
      await dsc.getDataSource(logger);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('action name', actionDefinition);
      expect(self.schema.actions['action name']).toBeDefined();
      expect(self).toEqual(customizer);
    });
  });

  describe('addChart', () => {
    it('should add a chart', async () => {
      const { dsc, customizer, stack } = await setup();
      const spy = jest.spyOn(stack.chart.getCollection('authors'), 'addChart');

      const chartDefinition: DataSourceChartDefinition = (ctx, rb) => rb.value(1);
      const self = customizer.addChart('chart name', chartDefinition);
      await dsc.getDataSource(logger);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('chart name', chartDefinition);
      expect(self.schema.charts).toContain('chart name');
      expect(self).toEqual(customizer);
    });
  });

  describe('addValidation', () => {
    it('should add a validation rule', async () => {
      const { dsc, customizer, stack } = await setup();
      const spy = jest.spyOn(stack.validation.getCollection('authors'), 'addValidation');

      const self = customizer.addFieldValidation('firstName', 'LongerThan', 5);
      await dsc.getDataSource(logger);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName', { operator: 'LongerThan', value: 5 });
      expect((self.schema.fields.firstName as ColumnSchema).validation).toStrictEqual([
        { operator: 'LongerThan', value: 5 },
      ]);
      expect(self).toEqual(customizer);
    });
  });

  describe('importField', () => {
    it('should call addField', async () => {
      const { dsc, customizer } = await setup();

      const spy = jest.spyOn(customizer, 'addField');
      const self = customizer.importField('firstNameCopy', { path: 'firstName' });
      await dsc.getDataSource(logger);

      expect(spy).toBeCalledTimes(1);
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
      const { dsc, customizer, stack } = await setup();
      const spy = jest.spyOn(stack.write.getCollection('authors'), 'replaceFieldWriting');

      const self = customizer.importField('translatorName', { path: 'translator:name' });
      await dsc.getDataSource(logger);

      expect(spy).toHaveBeenCalledWith('translatorName', expect.any(Function));
      const [[, definition]] = spy.mock.calls;
      expect(definition('newNameValue', {} as never)).toEqual({
        translator: { name: 'newNameValue' },
      });
      expect(self).toEqual(customizer);
    });

    describe('when the field is not writable', () => {
      it('should not call the replaceFieldWriting', async () => {
        const { dsc, customizer, stack } = await setup();
        const spy = jest.spyOn(stack.write.getCollection('authors'), 'replaceFieldWriting');

        const self = customizer.importField('translatorName', {
          path: 'translator:nameInReadOnly',
        });
        await dsc.getDataSource(logger);

        expect(spy).not.toHaveBeenCalled();
        expect(self).toEqual(customizer);
      });
    });

    describe('when the "readOnly" option is true', () => {
      it('should not call the replaceFieldWriting', async () => {
        const { dsc, customizer, stack } = await setup();
        const spy = jest.spyOn(stack.write.getCollection('authors'), 'replaceFieldWriting');

        const self = customizer.importField('translatorName', {
          path: 'translator:name',
          readonly: true,
        });
        await dsc.getDataSource(logger);

        expect(spy).not.toHaveBeenCalled();
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

        await expect(dsc.getDataSource(logger)).rejects.toThrowError(
          'Readonly option should not be false because the field' +
            ' "translator:nameInReadOnly" is not writable',
        );
      });
    });

    describe('when the given field does not exist', () => {
      it('should throw an error', async () => {
        const { dsc, customizer } = await setup();

        customizer.importField('translatorName', { path: 'doesNotExistPath' });
        await expect(dsc.getDataSource(logger)).rejects.toThrow(
          'Field doesNotExistPath not found in collection authors',
        );
      });
    });
  });

  describe('addField', () => {
    it('should add a field to early collection', async () => {
      const { dsc, customizer, stack } = await setup();
      const spy = jest.spyOn(stack.earlyComputed.getCollection('authors'), 'registerComputed');

      const fieldDefinition: ComputedDefinition = {
        columnType: 'String',
        dependencies: ['firstName'],
        getValues: records => records.map(() => 'aaa'),
      };

      const self = customizer.addField('new field', fieldDefinition);
      await dsc.getDataSource(logger);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('new field', fieldDefinition);
      expect(self.schema.fields['new field']).toBeDefined();
      expect(self).toEqual(customizer);

      const { getValues } = spy.mock.calls[0][1];
      expect(
        getValues([{ firstName: 'John' }], null as unknown as CollectionCustomizationContext),
      ).toStrictEqual(['aaa']);
    });

    it('should add a field to late collection', async () => {
      const { dsc, customizer, stack } = await setup();
      const spy = jest.spyOn(stack.lateComputed.getCollection('authors'), 'registerComputed');

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

      const self = customizer.addField('new field', fieldDefinition);
      await dsc.getDataSource(logger);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('new field', fieldDefinition);
      expect(self.schema.fields['new field']).toBeDefined();
      expect(self).toEqual(customizer);

      const { getValues } = spy.mock.calls[0][1];
      expect(
        getValues([{ firstName: 'John' }], null as unknown as CollectionCustomizationContext),
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

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstNameCopy', {
        columnType: [{ firstname: 'String', lastName: 'String' }],
        dependencies: ['authorId'],
        getValues: expect.any(Function),
      });
      expect(self).toEqual(customizer);

      const { getValues } = spy.mock.calls[0][1];
      const values = await getValues(
        [{ authorId: 1 }, { authorId: 2 }],
        null as unknown as CollectionCustomizationContext,
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

      const spy = jest.spyOn(stack.relation.getCollection('book_author'), 'addRelation');

      const self = customizer.addManyToOneRelation('myAuthor', 'authors', {
        foreignKey: 'authorFk',
        foreignKeyTarget: 'authorId',
      });
      await dsc.getDataSource(logger);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('myAuthor', {
        type: 'ManyToOne',
        foreignCollection: 'authors',
        foreignKey: 'authorFk',
        foreignKeyTarget: 'authorId',
      });
      expect(self.schema.fields.myAuthor).toBeDefined();
      expect(self).toEqual(customizer);
    });

    it('should add a one to one', async () => {
      const { dsc, customizer, stack } = await setup();

      const spy = jest.spyOn(stack.relation.getCollection('authors'), 'addRelation');

      const self = customizer.addOneToOneRelation('myBookAuthor', 'book_author', {
        originKey: 'authorFk',
        originKeyTarget: 'authorId',
      });
      await dsc.getDataSource(logger);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('myBookAuthor', {
        type: 'OneToOne',
        foreignCollection: 'book_author',
        originKey: 'authorFk',
        originKeyTarget: 'authorId',
      });
      expect(self.schema.fields.myBookAuthor).toBeDefined();
      expect(self).toEqual(customizer);
    });

    it('should add a one to many', async () => {
      const { dsc, customizer, stack } = await setup();

      const spy = jest.spyOn(stack.relation.getCollection('authors'), 'addRelation');

      const self = customizer.addOneToManyRelation('myBookAuthors', 'book_author', {
        originKey: 'authorFk',
        originKeyTarget: 'authorId',
      });
      await dsc.getDataSource(logger);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('myBookAuthors', {
        type: 'OneToMany',
        foreignCollection: 'book_author',
        originKey: 'authorFk',
        originKeyTarget: 'authorId',
      });
      expect(self.schema.fields.myBookAuthors).toBeDefined();
      expect(self).toEqual(customizer);
    });

    it('should add a many to many', async () => {
      const { dsc, customizer, stack } = await setup();
      const spy = jest.spyOn(stack.relation.getCollection('authors'), 'addRelation');

      const self = customizer.addManyToManyRelation('myBooks', 'books', 'book_author', {
        foreignKey: 'bookFk',
        foreignKeyTarget: 'bookId',
        originKey: 'authorFk',
        originKeyTarget: 'authorId',
      });
      await dsc.getDataSource(logger);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('myBooks', {
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
  });

  describe('addSegment', () => {
    it('should add a segment', async () => {
      const { dsc, customizer, stack } = await setup();
      const collection = stack.segment.getCollection('authors');

      const spy = jest.spyOn(collection, 'addSegment');

      const generator = async () => new ConditionTreeLeaf('fieldName', 'Present');

      const self = customizer.addSegment('new segment', generator);
      await dsc.getDataSource(logger);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('new segment', generator);
      expect(self.schema.segments).toEqual(expect.arrayContaining(['new segment']));
      expect(self).toEqual(customizer);
    });
  });

  describe('emulateFieldSorting', () => {
    it('should emulate sort on field', async () => {
      const { dsc, customizer, stack } = await setup();
      const collection = stack.sortEmulate.getCollection('authors');

      const spy = jest.spyOn(collection, 'emulateFieldSorting');

      const self = customizer.emulateFieldSorting('firstName');
      await dsc.getDataSource(logger);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName');
      expect(self).toEqual(customizer);
    });
  });

  describe('replaceFieldSorting', () => {
    it('should replace sort on field', async () => {
      const { dsc, customizer, stack } = await setup();
      const collection = stack.sortEmulate.getCollection('authors');

      const spy = jest.spyOn(collection, 'replaceFieldSorting');

      const sortClauses = [{ field: 'firstName', ascending: true }];
      const self = customizer.replaceFieldSorting('firstName', sortClauses);
      await dsc.getDataSource(logger);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName', new Sort(...sortClauses));
      expect(self).toEqual(customizer);
    });
  });

  describe('replaceFieldWriting', () => {
    it('should replace write on field', async () => {
      const { dsc, customizer, stack } = await setup();
      const collection = stack.write.getCollection('authors');

      const spy = jest.spyOn(collection, 'replaceFieldWriting');

      const definition: WriteDefinition = jest.fn();
      const self = customizer.replaceFieldWriting('firstName', definition);
      await dsc.getDataSource(logger);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName', definition);
      expect(self).toEqual(customizer);
    });
  });

  describe('emulateFieldFiltering', () => {
    it('should emulate operator on field', async () => {
      const { dsc, customizer, stack } = await setup();
      const collection = stack.earlyOpEmulate.getCollection('authors');

      const spy = jest.spyOn(collection, 'emulateFieldOperator');

      const self = customizer.emulateFieldFiltering('lastName');
      await dsc.getDataSource(logger);

      expect(spy).toBeCalledTimes(19);
      expect(self).toEqual(customizer);
    });
  });

  describe('emulateFieldOperator', () => {
    it('should emulate operator on field', async () => {
      const { dsc, customizer, stack } = await setup();
      const collection = stack.earlyOpEmulate.getCollection('authors');
      const spy = jest.spyOn(collection, 'emulateFieldOperator');

      const self = customizer.emulateFieldOperator('firstName', 'Present');
      await dsc.getDataSource(logger);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName', 'Present');
      expect(self).toEqual(customizer);
    });
  });

  describe('replaceFieldOperator', () => {
    it('should replace operator on field', async () => {
      const { dsc, customizer, stack } = await setup();
      const spy = jest.spyOn(stack.earlyOpEmulate.getCollection('authors'), 'replaceFieldOperator');

      const replacer = async () => new ConditionTreeLeaf('fieldName', 'NotEqual', null);

      const self = customizer.replaceFieldOperator('firstName', 'Present', replacer);
      await dsc.getDataSource(logger);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName', 'Present', replacer);
      expect(self).toEqual(customizer);
    });
  });

  describe('replaceSearch', () => {
    it('should call the search decorator', async () => {
      const { dsc, customizer, stack } = await setup();
      const spy = jest.spyOn(stack.search.getCollection('authors'), 'replaceSearch');

      const replacer = async search =>
        ({ field: 'firstName', operator: 'Equal', value: search } as const);

      const self = customizer.replaceSearch(replacer);
      await dsc.getDataSource(logger);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(replacer);
      expect(self).toEqual(customizer);
    });
  });

  describe('addHook', () => {
    it('should call the hook decorator', async () => {
      const { dsc, customizer, stack } = await setup();
      const spy = jest.spyOn(stack.hook.getCollection('authors'), 'addHook');

      const hookHandler = () => {};

      const self = customizer.addHook('Before', 'List', hookHandler);
      await dsc.getDataSource(logger);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('Before', 'List', hookHandler);
      expect(self).toEqual(customizer);
    });
  });
});
