import {
  ActionDefinition,
  ActionScope,
  ConditionTreeLeaf,
  FieldTypes,
  Operator,
  PrimitiveTypes,
  Sort,
  SortClause,
  WriteDefinition,
} from '@forestadmin/datasource-toolkit';

import * as factories from '../agent/__factories__';
import { FieldDefinition } from '../../src/builder/types';
import Agent from '../../src/builder/agent';
import CollectionBuilder from '../../src/builder/collection';
import FrontendFilterableUtils from '../../src/agent/utils/forest-schema/filterable';

describe('Builder > Collection', () => {
  const setup = () => {
    const options = factories.forestAdminHttpDriverOptions.build();
    const agent = new Agent(options);

    const collectionName = '__collection__';
    const dataSource = factories.dataSource.buildWithCollection(
      factories.collection.build({
        name: collectionName,
        schema: factories.collectionSchema.build({
          fields: {
            firstName: factories.columnSchema.build(),
            lastName: factories.columnSchema.build(),
          },
        }),
      }),
    );

    agent.addDatasource(dataSource);

    const collectionBuilder = new CollectionBuilder(agent, collectionName);

    return { agent, collectionBuilder, collectionName };
  };

  describe('renameField', () => {
    it('should rename a field', () => {
      const { agent, collectionBuilder, collectionName } = setup();

      const collection = agent.rename.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'renameField');

      const self = collectionBuilder.renameField('firstName', 'renamed');

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName', 'renamed');
      expect(collection.schema.fields.renamed).toBeDefined();
      expect(self).toEqual(collectionBuilder);
    });
  });

  describe('removeField', () => {
    it('should remove the field given fields', () => {
      const { agent, collectionBuilder, collectionName } = setup();

      const collection = agent.publication.getCollection(collectionName);
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
    it('should add an action', () => {
      const { agent, collectionBuilder, collectionName } = setup();

      const collection = agent.action.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'addAction');

      const actionDefinition: ActionDefinition = {
        scope: ActionScope.Global,
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
    it('should call addField', () => {
      const { collectionBuilder } = setup();
      const spy = jest.spyOn(collectionBuilder, 'addField');

      const self = collectionBuilder.importField('firstNameCopy', { path: 'firstName' });

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstNameCopy', {
        columnType: PrimitiveTypes.String,
        dependencies: ['firstName'],
        filterBy: expect.anything(),
        getValues: expect.any(Function),
        sortBy: [{ ascending: true, field: 'firstName' }],
      });
      expect(self).toEqual(collectionBuilder);
    });
  });

  describe('addField', () => {
    it('should add a field', () => {
      const { agent, collectionBuilder, collectionName } = setup();

      const collection = agent.lateComputed.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'registerComputed');

      const fieldDefinition: FieldDefinition = {
        columnType: PrimitiveTypes.String,
        dependencies: [],
        getValues: () => [],
      };

      const self = collectionBuilder.addField('new field', fieldDefinition);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('new field', fieldDefinition);
      expect(collection.schema.fields['new field']).toBeDefined();
      expect(self).toEqual(collectionBuilder);
    });

    describe('when sort by is emulated', () => {
      it('should register a field with sort emulation', () => {
        const { agent, collectionBuilder, collectionName } = setup();

        const collection = agent.sortEmulate.getCollection(collectionName);
        const spy = jest.spyOn(collection, 'emulateFieldSorting');

        const fieldDefinition: FieldDefinition = {
          columnType: PrimitiveTypes.String,
          dependencies: [],
          getValues: () => [],
          sortBy: 'emulate',
        };

        const self = collectionBuilder.addField('new field', fieldDefinition);

        expect(spy).toBeCalledTimes(1);
        expect(spy).toHaveBeenCalledWith('new field');
        expect(collection.schema.fields['new field']).toBeDefined();
        expect(self).toEqual(collectionBuilder);
      });
    });

    describe('when sort by has a defined definition', () => {
      it('should add a field with sorting clause', () => {
        const { agent, collectionBuilder, collectionName } = setup();

        const collection = agent.sortEmulate.getCollection(collectionName);
        const spy = jest.spyOn(collection, 'replaceFieldSorting');

        const fieldDefinition: FieldDefinition = {
          columnType: PrimitiveTypes.String,
          dependencies: [],
          getValues: () => [],
          sortBy: [{ field: 'firstName', ascending: true }],
        };

        const self = collectionBuilder.addField('new field', fieldDefinition);

        expect(spy).toBeCalledTimes(1);
        expect(spy).toHaveBeenCalledWith(
          'new field',
          new Sort(...(fieldDefinition.sortBy as SortClause[])),
        );
        expect(collection.schema.fields['new field']).toBeDefined();
        expect(self).toEqual(collectionBuilder);
      });
    });

    describe('when filter by is emulated', () => {
      it('should add a field with filter emulate', () => {
        const { agent, collectionBuilder, collectionName } = setup();

        const collection = agent.lateOpEmulate.getCollection(collectionName);
        const spy = jest.spyOn(collection, 'emulateFieldOperator');

        const fieldDefinition: FieldDefinition = {
          columnType: PrimitiveTypes.String,
          dependencies: [],
          getValues: () => [],
          filterBy: 'emulate',
        };

        const self = collectionBuilder.addField('new field', fieldDefinition);

        const requiredOperator = FrontendFilterableUtils.getRequiredOperators(
          PrimitiveTypes.String,
        );

        expect(spy).toBeCalledTimes(requiredOperator.length);
        expect(spy.mock.calls).toEqual(requiredOperator.map(operator => ['new field', operator]));
        expect(collection.schema.fields['new field']).toBeDefined();
        expect(self).toEqual(collectionBuilder);
      });
    });
  });

  describe('addRelation', () => {
    it('should add a relation', () => {
      const { agent, collectionBuilder, collectionName } = setup();

      const collection = agent.relation.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'addRelation');

      const relationDefinition = {
        type: FieldTypes.ManyToOne as const,
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
    it('should add a segment', () => {
      const { agent, collectionBuilder, collectionName } = setup();

      const collection = agent.segment.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'addSegment');

      const generator = async () => new ConditionTreeLeaf('fieldName', Operator.Present);

      const self = collectionBuilder.addSegment('new segment', generator);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('new segment', generator);
      expect(collection.schema.segments).toEqual(expect.arrayContaining(['new segment']));
      expect(self).toEqual(collectionBuilder);
    });
  });

  describe('emulateFieldSorting', () => {
    it('should emulate sort on field', () => {
      const { agent, collectionBuilder, collectionName } = setup();

      const collection = agent.sortEmulate.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'emulateFieldSorting');

      const self = collectionBuilder.emulateFieldSorting('firstName');

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName');
      expect(self).toEqual(collectionBuilder);
    });
  });

  describe('replaceFieldSorting', () => {
    it('should replace sort on field', () => {
      const { agent, collectionBuilder, collectionName } = setup();

      const collection = agent.sortEmulate.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'replaceFieldSorting');

      const sortClauses: SortClause[] = [{ field: 'firstName', ascending: true }];

      const self = collectionBuilder.replaceFieldSorting('firstName', sortClauses);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName', new Sort(...sortClauses));
      expect(self).toEqual(collectionBuilder);
    });
  });

  describe('replaceFieldWriting', () => {
    it('should replace write on field', () => {
      const { agent, collectionBuilder, collectionName } = setup();

      const collection = agent.write.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'replaceFieldWriting');

      const definition: WriteDefinition = jest.fn();
      collectionBuilder.replaceFieldWriting('firstName', definition);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName', definition);
    });
  });

  describe('emulateFieldOperator', () => {
    it('should emulate operator on field', () => {
      const { agent, collectionBuilder, collectionName } = setup();

      const collection = agent.lateOpEmulate.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'emulateFieldOperator');

      const self = collectionBuilder.emulateFieldOperator('firstName', Operator.Present);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName', Operator.Present);
      expect(self).toEqual(collectionBuilder);
    });
  });

  describe('replaceFieldOperator', () => {
    it('should replace operator on field', () => {
      const { agent, collectionBuilder, collectionName } = setup();

      const collection = agent.lateOpEmulate.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'replaceFieldOperator');

      const replacer = async () => new ConditionTreeLeaf('fieldName', Operator.NotEqual, null);

      const self = collectionBuilder.replaceFieldOperator('firstName', Operator.Present, replacer);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName', Operator.Present, replacer);
      expect(self).toEqual(collectionBuilder);
    });
  });
});
