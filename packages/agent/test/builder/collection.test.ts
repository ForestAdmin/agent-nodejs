import {
  ActionDefinition,
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
    const collectionName = '__collection__';
    const dataSource = factories.dataSource.buildWithCollection(
      factories.collection.build({
        name: collectionName,
        schema: factories.collectionSchema.build({
          fields: {
            firstName: factories.columnSchema.build({
              isSortable: true,
              filterOperators: new Set(['In']),
            }),
            lastName: factories.columnSchema.build({
              filterOperators: new Set(),
            }),
          },
        }),
      }),
    );
    const stack = new DecoratorsStack(dataSource);
    const collectionBuilder = new CollectionBuilder(stack, collectionName);

    return { stack, collectionBuilder, collectionName };
  };

  describe('renameField', () => {
    it('should rename a field', async () => {
      const { stack, collectionBuilder, collectionName } = await setup();

      const collection = stack.rename.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'renameField');

      const self = collectionBuilder.renameField('firstName', 'renamed');

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName', 'renamed');
      expect(collection.schema.fields.renamed).toBeDefined();
      expect(self).toEqual(collectionBuilder);
    });
  });

  describe('removeField', () => {
    it('should remove the field given fields', async () => {
      const { stack, collectionBuilder, collectionName } = await setup();

      const collection = stack.publication.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'changeFieldVisibility');

      const self = collectionBuilder.removeField('firstName', 'lastName');

      expect(spy).toBeCalledTimes(2);
      expect(spy).toHaveBeenNthCalledWith(1, 'firstName', false);
      expect(spy).toHaveBeenNthCalledWith(2, 'lastName', false);
      expect(collection.schema.fields.firstName).toBeUndefined();
      expect(collection.schema.fields.lastName).toBeUndefined();
      expect(self).toEqual(collectionBuilder);
    });
  });

  describe('addAction', () => {
    it('should add an action', async () => {
      const { stack, collectionBuilder, collectionName } = await setup();

      const collection = stack.action.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'addAction');

      const actionDefinition: ActionDefinition = {
        scope: 'Global',
        execute: () => {},
      };

      const self = collectionBuilder.addAction('action name', actionDefinition);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('action name', actionDefinition);
      expect(collection.schema.actions['action name']).toBeDefined();
      expect(self).toEqual(collectionBuilder);
    });
  });

  describe('importField', () => {
    it('should call addField', async () => {
      const { collectionBuilder } = await setup();
      const spy = jest.spyOn(collectionBuilder, 'addField');

      const self = collectionBuilder.importField('firstNameCopy', { path: 'firstName' });

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstNameCopy', {
        columnType: 'String',
        dependencies: ['firstName'],
        getValues: expect.any(Function),
      });
      expect(self).toEqual(collectionBuilder);
    });
  });

  describe('addField', () => {
    it('should add a field', async () => {
      const { stack, collectionBuilder, collectionName } = await setup();

      const collection = stack.lateComputed.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'registerComputed');

      const fieldDefinition: FieldDefinition = {
        columnType: 'String',
        dependencies: ['firstName'],
        getValues: () => [],
      };

      const self = collectionBuilder.addField('new field', fieldDefinition);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('new field', fieldDefinition);
      expect(collection.schema.fields['new field']).toBeDefined();
      expect(self).toEqual(collectionBuilder);
    });
  });

  describe('addRelation', () => {
    it('should add a relation', async () => {
      const { stack, collectionBuilder, collectionName } = await setup();

      const collection = stack.relation.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'addRelation');

      const relationDefinition = {
        type: 'ManyToOne' as const,
        foreignCollection: collectionName,
        foreignKey: 'firstName',
        foreignKeyTarget: 'firstName',
      };

      const self = collectionBuilder.addRelation('myself', relationDefinition);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('myself', relationDefinition);
      expect(collection.schema.fields.myself).toBeDefined();
      expect(self).toEqual(collectionBuilder);
    });
  });

  describe('addSegment', () => {
    it('should add a segment', async () => {
      const { stack, collectionBuilder, collectionName } = await setup();

      const collection = stack.segment.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'addSegment');

      const generator = async () => new ConditionTreeLeaf('fieldName', 'Present');

      const self = collectionBuilder.addSegment('new segment', generator);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('new segment', generator);
      expect(collection.schema.segments).toEqual(expect.arrayContaining(['new segment']));
      expect(self).toEqual(collectionBuilder);
    });
  });

  describe('emulateFieldSorting', () => {
    it('should emulate sort on field', async () => {
      const { stack, collectionBuilder, collectionName } = await setup();

      const collection = stack.sortEmulate.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'emulateFieldSorting');

      const self = collectionBuilder.emulateFieldSorting('firstName');

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName');
      expect(self).toEqual(collectionBuilder);
    });
  });

  describe('replaceFieldSorting', () => {
    it('should replace sort on field', async () => {
      const { stack, collectionBuilder, collectionName } = await setup();

      const collection = stack.sortEmulate.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'replaceFieldSorting');

      const sortClauses = [{ field: 'firstName', ascending: true }];
      const self = collectionBuilder.replaceFieldSorting('firstName', sortClauses);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName', new Sort(...sortClauses));
      expect(self).toEqual(collectionBuilder);
    });
  });

  describe('replaceFieldWriting', () => {
    it('should replace write on field', async () => {
      const { stack, collectionBuilder, collectionName } = await setup();

      const collection = stack.write.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'replaceFieldWriting');

      const definition: WriteDefinition = jest.fn();
      collectionBuilder.replaceFieldWriting('firstName', definition);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName', definition);
    });
  });

  describe('emulateFieldFiltering', () => {
    it('should emulate operator on field', async () => {
      const { stack, collectionBuilder, collectionName } = await setup();

      const collection = stack.earlyOpEmulate.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'emulateFieldOperator');

      const self = collectionBuilder.emulateFieldFiltering('lastName');

      expect(spy).toBeCalledTimes(9);
      expect(self).toEqual(collectionBuilder);
    });
  });

  describe('emulateFieldOperator', () => {
    it('should emulate operator on field', async () => {
      const { stack, collectionBuilder, collectionName } = await setup();

      const collection = stack.earlyOpEmulate.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'emulateFieldOperator');

      const self = collectionBuilder.emulateFieldOperator('firstName', 'Present');

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName', 'Present');
      expect(self).toEqual(collectionBuilder);
    });
  });

  describe('replaceFieldOperator', () => {
    it('should replace operator on field', async () => {
      const { stack, collectionBuilder, collectionName } = await setup();

      const collection = stack.earlyOpEmulate.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'replaceFieldOperator');

      const replacer = async () => new ConditionTreeLeaf('fieldName', 'NotEqual', null);

      const self = collectionBuilder.replaceFieldOperator('firstName', 'Present', replacer);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName', 'Present', replacer);
      expect(self).toEqual(collectionBuilder);
    });
  });
});
