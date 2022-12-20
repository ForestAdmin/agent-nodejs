import { Collection, DataSource } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

import SegmentCollectionDecorator from '../../../src/decorators/segment/collection';

describe('SegmentCollectionDecorator', () => {
  let dataSource: DataSource;
  let collection: Collection;
  let segmentDecorator: SegmentCollectionDecorator;

  beforeEach(() => {
    dataSource = factories.dataSource.buildWithCollection(
      factories.collection.build({
        name: 'books',
        schema: factories.collectionSchema.build({
          fields: {
            name: factories.columnSchema.build({
              filterOperators: new Set(['Equal', 'In']),
            }),
          },
        }),
      }),
    );
    collection = dataSource.getCollection('books');
    segmentDecorator = new SegmentCollectionDecorator(collection, dataSource);
  });

  describe('when there is no filter', () => {
    it('should return null', async () => {
      const conditionTreeGenerator = jest.fn();
      segmentDecorator.addSegment('segmentName', conditionTreeGenerator);

      const filter = await segmentDecorator.refineFilter(factories.caller.build());

      expect(filter).toEqual(null);
      expect(conditionTreeGenerator).not.toHaveBeenCalled();
    });
  });

  describe('when there is a filter', () => {
    describe('when the segment is not managed by this decorator', () => {
      it('should return the given filter', async () => {
        const conditionTreeGenerator = jest.fn();
        segmentDecorator.addSegment('segmentName', conditionTreeGenerator);

        const aFilter = factories.filter.build({ segment: 'aSegment' });
        const filter = await segmentDecorator.refineFilter(factories.caller.build(), aFilter);

        expect(filter).toEqual(aFilter);
        expect(conditionTreeGenerator).not.toHaveBeenCalled();
      });
    });

    describe('when the segment is managed by this decorator', () => {
      it('should return the filter with the merged conditionTree', async () => {
        const conditionTreeGenerator = jest.fn().mockResolvedValue(
          factories.conditionTreeLeaf.build({
            field: 'name',
            operator: 'Equal',
            value: 'aNameValue',
          }),
        );
        segmentDecorator.addSegment('segmentName', conditionTreeGenerator);

        const filter = await segmentDecorator.refineFilter(
          factories.caller.build(),
          factories.filter.build({
            segment: 'segmentName',
            conditionTree: factories.conditionTreeLeaf.build({
              operator: 'Equal',
              value: 'otherNameValue',
              field: 'name',
            }),
          }),
        );

        expect(conditionTreeGenerator).toHaveBeenCalled();
        expect(filter).toEqual({
          segment: null,
          conditionTree: {
            aggregator: 'And',
            conditions: [
              { operator: 'Equal', field: 'name', value: 'otherNameValue' },
              { operator: 'Equal', field: 'name', value: 'aNameValue' },
            ],
          },
        });
      });

      it('should throw an error when a conditionTree is not valid', async () => {
        const conditionTreeGenerator = jest.fn().mockResolvedValue(
          factories.conditionTreeLeaf.build({
            field: 'do not exists',
            operator: 'Equal',
            value: 'aNameValue',
          }),
        );
        segmentDecorator.addSegment('segmentName', conditionTreeGenerator);

        await expect(() =>
          segmentDecorator.refineFilter(
            factories.caller.build(),
            factories.filter.build({ segment: 'segmentName' }),
          ),
        ).rejects.toThrow("Column not found 'books.do not exists'");

        expect(conditionTreeGenerator).toHaveBeenCalled();
      });
    });
  });
});
