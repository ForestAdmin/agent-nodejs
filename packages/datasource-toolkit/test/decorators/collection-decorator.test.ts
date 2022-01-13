import * as factories from '../__factories__';

describe('CollectionDecorator', () => {
  const projection = factories.projection.build();
  const recordData = factories.recordData.build();
  const aggregation = factories.aggregation.build();
  const filter = factories.filter.build();

  describe('list', () => {
    it('calls the child method list with the refined filter and the projection', async () => {
      const childList = jest.fn();

      const decoratedCollection = factories.collection.buildDecoratedCollection({
        list: childList,
      });
      decoratedCollection.refineFilter = jest.fn().mockReturnValue(filter);

      await decoratedCollection.list(filter, projection);

      expect(decoratedCollection.refineFilter).toHaveBeenCalledWith(filter);
      expect(childList).toHaveBeenCalledWith(filter, projection);
    });
  });

  describe('update', () => {
    it('calls the child method update with the refined filter and the record data', async () => {
      const childUpdate = jest.fn();

      const decoratedCollection = factories.collection.buildDecoratedCollection({
        update: childUpdate,
      });
      decoratedCollection.refineFilter = jest.fn().mockReturnValue(filter);

      await decoratedCollection.update(filter, recordData);

      expect(decoratedCollection.refineFilter).toHaveBeenCalledWith(filter);
      expect(childUpdate).toHaveBeenCalledWith(filter, recordData);
    });
  });

  describe('delete', () => {
    it('calls the child method delete with the refined filter', async () => {
      const childDelete = jest.fn();

      const decoratedCollection = factories.collection.buildDecoratedCollection({
        delete: childDelete,
      });
      decoratedCollection.refineFilter = jest.fn().mockReturnValue(filter);

      await decoratedCollection.delete(filter);

      expect(decoratedCollection.refineFilter).toHaveBeenCalledWith(filter);
      expect(childDelete).toHaveBeenCalledWith(filter);
    });
  });

  describe('aggregate', () => {
    it('calls the child method aggregate with the refined filter and the aggregation', async () => {
      const childAggregate = jest.fn();

      const decoratedCollection = factories.collection.buildDecoratedCollection({
        aggregate: childAggregate,
      });
      decoratedCollection.refineFilter = jest.fn().mockReturnValue(filter);

      await decoratedCollection.aggregate(filter, aggregation);

      expect(decoratedCollection.refineFilter).toHaveBeenCalledWith(filter);
      expect(childAggregate).toHaveBeenCalledWith(filter, aggregation);
    });
  });
});
