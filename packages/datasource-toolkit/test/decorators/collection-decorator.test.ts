/* eslint-disable max-classes-per-file */

import * as factories from '../__factories__';
import CollectionDecorator from '../../src/decorators/collection-decorator';

describe('CollectionDecorator', () => {
  describe('list', () => {
    it('calls the child method list with the refined filter and the projection', async () => {
      const projection = factories.projection.build();
      const recordData = factories.recordData.build();
      const filter = factories.filter.build();
      const childList = jest.fn().mockReturnValue([recordData]);

      const decoratedCollection = factories.collection.buildDecoratedCollection({
        list: childList,
      });
      decoratedCollection.refineFilter = jest.fn().mockReturnValue(filter);

      const caller = factories.caller.build();
      const result = await decoratedCollection.list(caller, filter, projection);

      expect(result).toEqual([recordData]);
      expect(decoratedCollection.refineFilter).toHaveBeenCalledWith(caller, filter);
      expect(childList).toHaveBeenCalledWith(caller, filter, projection);
    });
  });

  describe('update', () => {
    it('calls the child method update with the refined filter and the record data', async () => {
      const recordData = factories.recordData.build();
      const filter = factories.filter.build();
      const childUpdate = jest.fn();
      const decoratedCollection = factories.collection.buildDecoratedCollection({
        update: childUpdate,
      });
      decoratedCollection.refineFilter = jest.fn().mockReturnValue(filter);

      const caller = factories.caller.build();
      await decoratedCollection.update(caller, filter, recordData);

      expect(decoratedCollection.refineFilter).toHaveBeenCalledWith(caller, filter);
      expect(childUpdate).toHaveBeenCalledWith(caller, filter, recordData);
    });
  });

  describe('delete', () => {
    it('calls the child method delete with the refined filter', async () => {
      const filter = factories.filter.build();
      const childDelete = jest.fn();
      const decoratedCollection = factories.collection.buildDecoratedCollection({
        delete: childDelete,
      });
      decoratedCollection.refineFilter = jest.fn().mockReturnValue(filter);

      const caller = factories.caller.build();
      await decoratedCollection.delete(caller, filter);

      expect(decoratedCollection.refineFilter).toHaveBeenCalledWith(caller, filter);
      expect(childDelete).toHaveBeenCalledWith(caller, filter);
    });
  });

  describe('aggregate', () => {
    it('calls the child method aggregate with the refined filter and the aggregation', async () => {
      const aggregation = factories.aggregation.build();
      const filter = factories.filter.build();

      const aggregateResult = factories.aggregateResult.build();
      const childAggregate = jest.fn().mockReturnValue([aggregateResult]);

      const decoratedCollection = factories.collection.buildDecoratedCollection({
        aggregate: childAggregate,
      });
      decoratedCollection.refineFilter = jest.fn().mockReturnValue(filter);

      const caller = factories.caller.build();
      const result = await decoratedCollection.aggregate(caller, filter, aggregation, null);

      expect(result).toStrictEqual([aggregateResult]);
      expect(decoratedCollection.refineFilter).toHaveBeenCalledWith(caller, filter);
      expect(childAggregate).toHaveBeenCalledWith(caller, filter, aggregation, null);
    });
  });

  describe('schema', () => {
    it('returns the refined schema from the the child schema', async () => {
      const schema = factories.collectionSchema.build();

      const decoratedCollection = factories.collection.buildDecoratedCollection();
      decoratedCollection.refineSchema = jest.fn().mockReturnValue(schema);

      const result = decoratedCollection.schema;

      expect(schema).toEqual(result);
      expect(decoratedCollection.refineSchema).toHaveBeenCalledWith(schema);
    });

    it('when the child schema does not change, refine schema should be called once', async () => {
      // "Identity decorator"
      const refineSchema = jest.fn().mockImplementation(child => child);
      const MyDecorator = class extends CollectionDecorator {
        refineSchema = refineSchema;
      };

      // Create collections
      const child = factories.collection.build({ schema: factories.collectionSchema.build() });
      const parent = new MyDecorator(child, null);
      parent.schema; // eslint-disable-line @typescript-eslint/no-unused-expressions
      parent.schema; // eslint-disable-line @typescript-eslint/no-unused-expressions
      expect(refineSchema).toHaveBeenCalledTimes(1);
    });

    it('when the child schema changes everytime, refine schema should be called', async () => {
      // "Identity decorator"
      const refineSchema = jest.fn().mockImplementation(child => child);
      const MyDecorator = class extends CollectionDecorator {
        refineSchema = refineSchema;
      };

      // Create collections
      const child = factories.collection.build({ schema: factories.collectionSchema.build() });
      Object.defineProperty(child, 'schema', { get: () => factories.collectionSchema.build() });

      const parent = new MyDecorator(child, null);
      parent.schema; // eslint-disable-line @typescript-eslint/no-unused-expressions
      parent.schema; // eslint-disable-line @typescript-eslint/no-unused-expressions
      parent.schema; // eslint-disable-line @typescript-eslint/no-unused-expressions
      expect(refineSchema).toHaveBeenCalledTimes(3);
    });
  });

  describe('create', () => {
    it('calls the child method create', async () => {
      const recordData = factories.recordData.build();
      const childCreate = jest.fn();
      const decoratedCollection = factories.collection.buildDecoratedCollection({
        create: childCreate,
      });

      const caller = factories.caller.build();
      await decoratedCollection.create(caller, [recordData]);

      expect(childCreate).toHaveBeenCalledWith(caller, [recordData]);
    });
  });

  describe('dataSource', () => {
    it('owns its datasource', () => {
      const parentDataSource = factories.dataSource.build();
      const childDataSource = factories.dataSource.build();
      const parentCollection = factories.collection.buildDecoratedCollection(
        { dataSource: childDataSource },
        parentDataSource,
      );

      expect(parentCollection.dataSource).toBe(parentDataSource);
    });
  });

  describe('getForm', () => {
    it('calls the child getForm method', async () => {
      const fields = { type: 'String', label: 'field ' };
      const childGetForm = jest.fn().mockReturnValue(fields);
      const decoratedCollection = factories.collection.buildDecoratedCollection({
        getForm: childGetForm,
      });

      const caller = factories.caller.build();
      const result = await decoratedCollection.getForm(caller, 'an action name', {}, null);

      expect(result).toStrictEqual(fields);
      expect(childGetForm).toHaveBeenCalledWith(caller, 'an action name', {}, null);
    });
  });

  describe('execute', () => {
    it('calls the child execute method', async () => {
      const response = { type: 'Success' };
      const childExecute = jest.fn().mockReturnValue(response);
      const decoratedCollection = factories.collection.buildDecoratedCollection({
        execute: childExecute,
      });

      const caller = factories.caller.build();
      const result = await decoratedCollection.execute(caller, 'an action name', {}, null);

      expect(result).toStrictEqual(response);
      expect(childExecute).toHaveBeenCalledWith(caller, 'an action name', {}, null);
    });
  });

  describe('name', () => {
    it('calls the child name', async () => {
      const decoratedCollection = factories.collection.buildDecoratedCollection({
        name: 'a name',
      });

      expect(decoratedCollection.name).toStrictEqual('a name');
    });
  });

  describe('refineFilter', () => {
    it('should be the identity function', async () => {
      const decoratedCollection = factories.collection.buildDecoratedCollection({});
      const filter = factories.filter.build();

      expect(await decoratedCollection.refineFilter(factories.caller.build(), filter)).toBe(filter);
    });
  });
});
