import {
  ActionDefinition,
  ColumnSchema,
  ConditionTreeLeaf,
  Sort,
  WriteDefinition,
} from '@forestadmin/datasource-toolkit';

import * as factories from '../agent/__factories__';
import { FieldDefinition } from '../../src/builder/types';
import CollectionBuilder from '../../src/builder/collection';
import DecoratorsStack from '../../dist/builder/decorators-stack';

describe('Builder > Collection', () => {
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
            authorId: factories.columnSchema.isPrimaryKey().build({
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
            authorFk: factories.columnSchema.isPrimaryKey().build({
              filterOperators: new Set(['Equal', 'In']),
            }),
            bookFk: factories.columnSchema.isPrimaryKey().build({
              filterOperators: new Set(['Equal', 'In']),
            }),
          },
        }),
      }),
      factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            bookId: factories.columnSchema.isPrimaryKey().build({
              filterOperators: new Set(['Equal', 'In']),
            }),
            title: factories.columnSchema.build({ columnType: 'String' }),
          },
        }),
      }),
    ]);
    const stack = new DecoratorsStack(dataSource);

    return { stack };
  };

  describe('disableCount', () => {
    it('should edit the schema', async () => {
      const { stack } = await setup();
      const collection = stack.schema.getCollection('authors');
      const builder = new CollectionBuilder(stack, 'authors');
      const spy = jest.spyOn(collection, 'overrideSchema');

      const self = builder.disableCount();

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({ countable: false });
      expect(collection.schema.countable).toBeFalsy();
      expect(self).toEqual(builder);
    });
  });

  describe('renameField', () => {
    it('should rename a field', async () => {
      const { stack } = await setup();
      const collection = stack.renameField.getCollection('authors');
      const builder = new CollectionBuilder(stack, 'authors');
      const spy = jest.spyOn(collection, 'renameField');

      const self = builder.renameField('firstName', 'renamed');

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName', 'renamed');
      expect(collection.schema.fields.renamed).toBeDefined();
      expect(self).toEqual(builder);
    });
  });

  describe('removeField', () => {
    it('should remove the field given fields', async () => {
      const { stack } = await setup();
      const collection = stack.publication.getCollection('authors');
      const builder = new CollectionBuilder(stack, 'authors');
      const spy = jest.spyOn(collection, 'changeFieldVisibility');

      const self = builder.removeField('firstName', 'lastName');

      expect(spy).toBeCalledTimes(2);
      expect(spy).toHaveBeenNthCalledWith(1, 'firstName', false);
      expect(spy).toHaveBeenNthCalledWith(2, 'lastName', false);
      expect(collection.schema.fields.firstName).toBeUndefined();
      expect(collection.schema.fields.lastName).toBeUndefined();
      expect(self).toEqual(builder);
    });
  });

  describe('addAction', () => {
    it('should add an action', async () => {
      const { stack } = await setup();
      const collection = stack.action.getCollection('authors');
      const builder = new CollectionBuilder(stack, 'authors');

      const spy = jest.spyOn(collection, 'addAction');

      const actionDefinition: ActionDefinition = { scope: 'Global', execute: () => {} };
      const self = builder.addAction('action name', actionDefinition);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('action name', actionDefinition);
      expect(collection.schema.actions['action name']).toBeDefined();
      expect(self).toEqual(builder);
    });
  });

  describe('addValidation', () => {
    it('should add a validation rule', async () => {
      const { stack } = await setup();
      const collection = stack.validation.getCollection('authors');
      const builder = new CollectionBuilder(stack, 'authors');

      const spy = jest.spyOn(collection, 'addValidation');
      const self = builder.addFieldValidation('firstName', 'LongerThan', 5);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName', { operator: 'LongerThan', value: 5 });
      expect((collection.schema.fields.firstName as ColumnSchema).validation).toStrictEqual([
        { operator: 'LongerThan', value: 5 },
      ]);
      expect(self).toEqual(builder);
    });
  });

  describe('importField', () => {
    it('should call addField', async () => {
      const { stack } = await setup();
      const builder = new CollectionBuilder(stack, 'authors');
      const spy = jest.spyOn(builder, 'addField');
      const self = builder.importField('firstNameCopy', { path: 'firstName' });

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstNameCopy', {
        columnType: 'String',
        dependencies: ['firstName'],
        getValues: expect.any(Function),
      });
      expect(self).toEqual(builder);

      const { getValues } = spy.mock.calls[0][1];
      expect(getValues([{ firstName: 'John' }], null)).toStrictEqual(['John']);
    });

    it('should call the replaceFieldWriting with the correct path', async () => {
      const { stack } = await setup();
      const builder = new CollectionBuilder(stack, 'authors');
      const collection = stack.write.getCollection('authors');
      const replaceFieldWritingSpy = jest.spyOn(collection, 'replaceFieldWriting');

      builder.importField('translatorName', { path: 'translator:name' });

      expect(replaceFieldWritingSpy).toHaveBeenCalledWith('translatorName', expect.any(Function));
      const [[, definition]] = replaceFieldWritingSpy.mock.calls;
      expect(definition('newNameValue', {} as never)).toEqual({
        translator: { name: 'newNameValue' },
      });
    });

    describe('when the field is not writable', () => {
      it('should not call the replaceFieldWriting', async () => {
        const { stack } = await setup();
        const builder = new CollectionBuilder(stack, 'authors');
        const collection = stack.write.getCollection('authors');
        const replaceFieldWritingSpy = jest.spyOn(collection, 'replaceFieldWriting');

        builder.importField('translatorName', { path: 'translator:nameInReadOnly' });

        expect(replaceFieldWritingSpy).not.toHaveBeenCalled();
      });
    });

    describe('when the "readOnly" option is true', () => {
      it('should not call the replaceFieldWriting', async () => {
        const { stack } = await setup();
        const builder = new CollectionBuilder(stack, 'authors');
        const collection = stack.write.getCollection('authors');
        const replaceFieldWritingSpy = jest.spyOn(collection, 'replaceFieldWriting');

        builder.importField('translatorName', { path: 'translator:name', readonly: true });

        expect(replaceFieldWritingSpy).not.toHaveBeenCalled();
      });
    });

    describe('when the "readOnly" option is false and the schema doest not allow to write', () => {
      it('should throw an error', async () => {
        const { stack } = await setup();
        const builder = new CollectionBuilder(stack, 'authors');

        expect(() =>
          builder.importField('translatorName', {
            path: 'translator:nameInReadOnly',
            readonly: false,
          }),
        ).toThrowError(
          'Readonly option should not be false because the field' +
            ' "translator:nameInReadOnly" is not writable',
        );
      });
    });
  });

  describe('addField', () => {
    it('should add a field', async () => {
      const { stack } = await setup();
      const collection = stack.lateComputed.getCollection('authors');
      const builder = new CollectionBuilder(stack, 'authors');
      const spy = jest.spyOn(collection, 'registerComputed');

      const fieldDefinition: FieldDefinition = {
        columnType: 'String',
        dependencies: ['firstName'],
        getValues: records => records.map(() => 'aaa'),
      };

      const self = builder.addField('new field', fieldDefinition);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('new field', fieldDefinition);
      expect(collection.schema.fields['new field']).toBeDefined();
      expect(self).toEqual(builder);

      const { getValues } = spy.mock.calls[0][1];
      expect(getValues([{ firstName: 'John' }], null)).toStrictEqual(['aaa']);
    });
  });

  describe('addExternalRelation', () => {
    it('should call addField', async () => {
      const { stack } = await setup();
      const builder = new CollectionBuilder(stack, 'authors');
      const spy = jest.spyOn(builder, 'addField');
      const self = builder.addExternalRelation('firstNameCopy', {
        schema: { firstname: 'String', lastName: 'String' },
        listRecords: () => {
          return [{ firstname: 'John', lastName: 'Doe' }];
        },
      });

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstNameCopy', {
        columnType: [{ firstname: 'String', lastName: 'String' }],
        dependencies: ['authorId'],
        getValues: expect.any(Function),
      });
      expect(self).toEqual(builder);

      const { getValues } = spy.mock.calls[0][1];
      const values = await getValues([{ authorId: 1 }, { authorId: 2 }], null);
      expect(values).toStrictEqual([
        [{ firstname: 'John', lastName: 'Doe' }],
        [{ firstname: 'John', lastName: 'Doe' }],
      ]);
    });
  });

  describe('relations', () => {
    it('should add a many to one', async () => {
      const { stack } = await setup();
      const collection = stack.relation.getCollection('book_author');
      const builder = new CollectionBuilder(stack, 'book_author');
      const spy = jest.spyOn(collection, 'addRelation');

      const self = builder.addManyToOneRelation('myAuthor', 'authors', {
        foreignKey: 'authorFk',
        foreignKeyTarget: 'authorId',
      });

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('myAuthor', {
        type: 'ManyToOne',
        foreignCollection: 'authors',
        foreignKey: 'authorFk',
        foreignKeyTarget: 'authorId',
      });
      expect(collection.schema.fields.myAuthor).toBeDefined();
      expect(self).toEqual(builder);
    });

    it('should add a one to one', async () => {
      const { stack } = await setup();
      const collection = stack.relation.getCollection('authors');
      const builder = new CollectionBuilder(stack, 'authors');
      const spy = jest.spyOn(collection, 'addRelation');

      const self = builder.addOneToOneRelation('myBookAuthor', 'book_author', {
        originKey: 'authorFk',
        originKeyTarget: 'authorId',
      });

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('myBookAuthor', {
        type: 'OneToOne',
        foreignCollection: 'book_author',
        originKey: 'authorFk',
        originKeyTarget: 'authorId',
      });
      expect(collection.schema.fields.myBookAuthor).toBeDefined();
      expect(self).toEqual(builder);
    });

    it('should add a one to many', async () => {
      const { stack } = await setup();
      const collection = stack.relation.getCollection('authors');
      const builder = new CollectionBuilder(stack, 'authors');
      const spy = jest.spyOn(collection, 'addRelation');

      const self = builder.addOneToManyRelation('myBookAuthors', 'book_author', {
        originKey: 'authorFk',
        originKeyTarget: 'authorId',
      });

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('myBookAuthors', {
        type: 'OneToMany',
        foreignCollection: 'book_author',
        originKey: 'authorFk',
        originKeyTarget: 'authorId',
      });
      expect(collection.schema.fields.myBookAuthors).toBeDefined();
      expect(self).toEqual(builder);
    });

    it('should add a many to many', async () => {
      const { stack } = await setup();
      const collection = stack.relation.getCollection('authors');
      const spy = jest.spyOn(collection, 'addRelation');
      const builder = new CollectionBuilder(stack, 'authors');

      const self = builder.addManyToManyRelation('myBooks', 'books', 'book_author', {
        foreignKey: 'bookFk',
        foreignKeyTarget: 'bookId',
        originKey: 'authorFk',
        originKeyTarget: 'authorId',
      });

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
      expect(collection.schema.fields.myBooks).toBeDefined();
      expect(self).toEqual(builder);
    });
  });

  describe('addSegment', () => {
    it('should add a segment', async () => {
      const { stack } = await setup();
      const collection = stack.segment.getCollection('authors');
      const builder = new CollectionBuilder(stack, 'authors');
      const spy = jest.spyOn(collection, 'addSegment');

      const generator = async () => new ConditionTreeLeaf('fieldName', 'Present');

      const self = builder.addSegment('new segment', generator);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('new segment', generator);
      expect(collection.schema.segments).toEqual(expect.arrayContaining(['new segment']));
      expect(self).toEqual(builder);
    });
  });

  describe('emulateFieldSorting', () => {
    it('should emulate sort on field', async () => {
      const { stack } = await setup();
      const collection = stack.sortEmulate.getCollection('authors');
      const builder = new CollectionBuilder(stack, 'authors');
      const spy = jest.spyOn(collection, 'emulateFieldSorting');

      const self = builder.emulateFieldSorting('firstName');

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName');
      expect(self).toEqual(builder);
    });
  });

  describe('replaceFieldSorting', () => {
    it('should replace sort on field', async () => {
      const { stack } = await setup();
      const collection = stack.sortEmulate.getCollection('authors');
      const builder = new CollectionBuilder(stack, 'authors');
      const spy = jest.spyOn(collection, 'replaceFieldSorting');

      const sortClauses = [{ field: 'firstName', ascending: true }];
      const self = builder.replaceFieldSorting('firstName', sortClauses);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName', new Sort(...sortClauses));
      expect(self).toEqual(builder);
    });
  });

  describe('replaceFieldWriting', () => {
    it('should replace write on field', async () => {
      const { stack } = await setup();
      const collection = stack.write.getCollection('authors');
      const builder = new CollectionBuilder(stack, 'authors');
      const spy = jest.spyOn(collection, 'replaceFieldWriting');

      const definition: WriteDefinition = jest.fn();
      builder.replaceFieldWriting('firstName', definition);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName', definition);
    });
  });

  describe('emulateFieldFiltering', () => {
    it('should emulate operator on field', async () => {
      const { stack } = await setup();
      const collection = stack.earlyOpEmulate.getCollection('authors');
      const builder = new CollectionBuilder(stack, 'authors');
      const spy = jest.spyOn(collection, 'emulateFieldOperator');

      const self = builder.emulateFieldFiltering('lastName');

      expect(spy).toBeCalledTimes(19);
      expect(self).toEqual(builder);
    });
  });

  describe('emulateFieldOperator', () => {
    it('should emulate operator on field', async () => {
      const { stack } = await setup();
      const collection = stack.earlyOpEmulate.getCollection('authors');
      const spy = jest.spyOn(collection, 'emulateFieldOperator');
      const builder = new CollectionBuilder(stack, 'authors');

      const self = builder.emulateFieldOperator('firstName', 'Present');

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName', 'Present');
      expect(self).toEqual(builder);
    });
  });

  describe('replaceFieldOperator', () => {
    it('should replace operator on field', async () => {
      const { stack } = await setup();
      const collection = stack.earlyOpEmulate.getCollection('authors');
      const builder = new CollectionBuilder(stack, 'authors');
      const spy = jest.spyOn(collection, 'replaceFieldOperator');

      const replacer = async () => new ConditionTreeLeaf('fieldName', 'NotEqual', null);

      const self = builder.replaceFieldOperator('firstName', 'Present', replacer);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName', 'Present', replacer);
      expect(self).toEqual(builder);
    });
  });

  describe('replaceSearch', () => {
    it('should call the search decorator', async () => {
      const { stack } = await setup();
      const collection = stack.search.getCollection('authors');
      const builder = new CollectionBuilder(stack, 'authors');
      const spy = jest.spyOn(collection, 'replaceSearch');

      const replacer = async search =>
        ({ field: 'firstName', operator: 'Equal', value: search } as const);

      const self = builder.replaceSearch(replacer);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(replacer);
      expect(self).toEqual(builder);
    });
  });

  describe('addHook', () => {
    it('should call the hook decorator', async () => {
      const { stack } = await setup();
      const collection = stack.hook.getCollection('authors');
      const builder = new CollectionBuilder(stack, 'authors');
      const spy = jest.spyOn(collection, 'addHook');

      const hookHandler = () => {};

      const self = builder.addHook('Before', 'List', hookHandler);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('Before', 'List', hookHandler);
      expect(self).toEqual(builder);
    });
  });
});
