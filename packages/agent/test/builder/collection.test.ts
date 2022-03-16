import {
  ActionDefinition,
  ActionScope,
  ConditionTreeLeaf,
  Operator,
  PrimitiveTypes,
  Sort,
  SortClause,
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

      collectionBuilder.renameField('firstName', 'renamed');

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName', 'renamed');
      expect(collection.schema.fields.renamed).toBeDefined();
    });
  });

  describe('publishFields', () => {
    it('should publish a field', () => {
      const { agent, collectionBuilder, collectionName } = setup();

      const collection = agent.publication.getCollection(collectionName);

      collectionBuilder.unpublishFields(['firstName']);
      expect(collection.schema.fields.firstName).toBeUndefined();

      const spy = jest.spyOn(collection, 'changeFieldVisibility');

      collectionBuilder.publishFields(['firstName']);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName', true);
      expect(collection.schema.fields.firstName).toBeDefined();
    });
  });

  describe('unpublishFields', () => {
    it('should unpublish a field', () => {
      const { agent, collectionBuilder, collectionName } = setup();

      const collection = agent.publication.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'changeFieldVisibility');

      collectionBuilder.unpublishFields(['firstName']);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName', false);
      expect(collection.schema.fields.firstName).toBeUndefined();
    });
  });

  describe('registerAction', () => {
    it('should register an action', () => {
      const { agent, collectionBuilder, collectionName } = setup();

      const collection = agent.action.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'registerAction');

      const actionDefinition: ActionDefinition = {
        scope: ActionScope.Global,
        execute: () => {},
      };

      collectionBuilder.registerAction('action name', actionDefinition);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('action name', actionDefinition);
      expect(collection.schema.actions['action name']).toBeDefined();
    });
  });

  describe('registerField', () => {
    it('should register a field', () => {
      const { agent, collectionBuilder, collectionName } = setup();

      const collection = agent.computed.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'registerComputed');

      const fieldDefinition: FieldDefinition = {
        columnType: PrimitiveTypes.String,
        dependencies: [],
        getValues: () => [],
      };

      collectionBuilder.registerField('new field', fieldDefinition);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('new field', fieldDefinition);
      expect(collection.schema.fields['new field']).toBeDefined();
    });

    describe('when sort by is emulated', () => {
      it('should register a field with sort emulation', () => {
        const { agent, collectionBuilder, collectionName } = setup();

        const collection = agent.sortEmulate.getCollection(collectionName);
        const spy = jest.spyOn(collection, 'emulateSort');

        const fieldDefinition: FieldDefinition = {
          columnType: PrimitiveTypes.String,
          dependencies: [],
          getValues: () => [],
          sortBy: 'emulate',
        };

        collectionBuilder.registerField('new field', fieldDefinition);

        expect(spy).toBeCalledTimes(1);
        expect(spy).toHaveBeenCalledWith('new field');
        expect(collection.schema.fields['new field']).toBeDefined();
      });
    });

    describe('when sort by has a defined definition', () => {
      it('should register a field with sorting clause', () => {
        const { agent, collectionBuilder, collectionName } = setup();

        const collection = agent.sortEmulate.getCollection(collectionName);
        const spy = jest.spyOn(collection, 'implementSort');

        const fieldDefinition: FieldDefinition = {
          columnType: PrimitiveTypes.String,
          dependencies: [],
          getValues: () => [],
          sortBy: [{ field: 'firstName', ascending: true }],
        };

        collectionBuilder.registerField('new field', fieldDefinition);

        expect(spy).toBeCalledTimes(1);
        expect(spy).toHaveBeenCalledWith(
          'new field',
          new Sort(...(fieldDefinition.sortBy as SortClause[])),
        );
        expect(collection.schema.fields['new field']).toBeDefined();
      });
    });

    describe('when filter by is emulated', () => {
      it('should register a field with filter emulate', () => {
        const { agent, collectionBuilder, collectionName } = setup();

        const collection = agent.operatorEmulate.getCollection(collectionName);
        const spy = jest.spyOn(collection, 'emulateOperator');

        const fieldDefinition: FieldDefinition = {
          columnType: PrimitiveTypes.String,
          dependencies: [],
          getValues: () => [],
          filterBy: 'emulate',
        };

        collectionBuilder.registerField('new field', fieldDefinition);

        const requiredOperator = FrontendFilterableUtils.getRequiredOperators(
          PrimitiveTypes.String,
        );

        expect(spy).toBeCalledTimes(requiredOperator.length);
        expect(spy.mock.calls).toEqual(requiredOperator.map(operator => ['new field', operator]));
        expect(collection.schema.fields['new field']).toBeDefined();
      });
    });
  });

  describe('registerSegment', () => {
    it('should register a segment', () => {
      const { agent, collectionBuilder, collectionName } = setup();

      const collection = agent.segment.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'registerSegment');

      const generator = async () => new ConditionTreeLeaf('fieldName', Operator.Present);

      collectionBuilder.registerSegment('new segment', generator);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('new segment', generator);
      expect(collection.schema.segments).toEqual(expect.arrayContaining(['new segment']));
    });
  });

  describe('emulateSort', () => {
    it('should emulate sort on field', () => {
      const { agent, collectionBuilder, collectionName } = setup();

      const collection = agent.sortEmulate.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'emulateSort');

      collectionBuilder.emulateSort('firstName');

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName');
    });
  });

  describe('implementSort', () => {
    it('should implement sort on field', () => {
      const { agent, collectionBuilder, collectionName } = setup();

      const collection = agent.sortEmulate.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'implementSort');

      const sortClauses: SortClause[] = [{ field: 'firstName', ascending: true }];

      collectionBuilder.implementSort('firstName', sortClauses);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName', new Sort(...sortClauses));
    });
  });

  describe('emulateOperator', () => {
    it('should emulate operator on field', () => {
      const { agent, collectionBuilder, collectionName } = setup();

      const collection = agent.operatorEmulate.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'emulateOperator');

      collectionBuilder.emulateOperator('firstName', Operator.Present);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName', Operator.Present);
    });
  });

  describe('implementOperator', () => {
    it('should implement operator on field', () => {
      const { agent, collectionBuilder, collectionName } = setup();

      const collection = agent.operatorEmulate.getCollection(collectionName);
      const spy = jest.spyOn(collection, 'implementOperator');

      const replacer = async () => new ConditionTreeLeaf('fieldName', Operator.NotEqual, null);

      collectionBuilder.implementOperator('firstName', Operator.Present, replacer);

      expect(spy).toBeCalledTimes(1);
      expect(spy).toHaveBeenCalledWith('firstName', Operator.Present, replacer);
    });
  });
});
