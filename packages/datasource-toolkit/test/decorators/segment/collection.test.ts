import * as factories from '../../__factories__';
import { Operator } from '../../../src/interfaces/query/condition-tree/nodes/leaf';
import ConditionTree from '../../../src/interfaces/query/condition-tree/nodes/base';
import SegmentCollectionDecorator from '../../../src/decorators/segment/collection';

describe('SegmentCollectionDecorator', () => {
  let segmentDecorator: SegmentCollectionDecorator;
  let conditionTreeGenerator: () => Promise<ConditionTree>;

  beforeEach(() => {
    const collection = factories.collection.build();
    segmentDecorator = new SegmentCollectionDecorator(collection, null);
    conditionTreeGenerator = async () => Promise.resolve(factories.conditionTreeLeaf.build());
  });

  describe('refineFilter', () => {
    describe('when there is no filter', () => {
      it('should return null', async () => {
        segmentDecorator.registerSegment('segmentName', conditionTreeGenerator);

        const filter = await segmentDecorator.refineFilter();
        expect(filter).toEqual(null);
      });
    });

    describe('when there is a filter', () => {
      describe('when the segment is not managed by this decorator', () => {
        it('should return the given filter', async () => {
          segmentDecorator.registerSegment('segmentName', conditionTreeGenerator);

          const aFilter = factories.filter.build({ segment: 'aSegment' });
          const filter = await segmentDecorator.refineFilter(aFilter);

          expect(filter).toEqual(aFilter);
        });
      });

      describe('when the segment is managed by this decorator', () => {
        it('should return the filter with the merged conditionTree', async () => {
          const collection = factories.collection.build({
            schema: factories.collectionSchema.build({
              fields: {
                name: factories.columnSchema.build({}),
              },
            }),
          });
          segmentDecorator = new SegmentCollectionDecorator(collection, null);

          conditionTreeGenerator = async () =>
            Promise.resolve(
              factories.conditionTreeLeaf.build({
                field: 'name',
                operator: Operator.Equal,
                value: 'aNameValue',
              }),
            );
          segmentDecorator.registerSegment('segmentName', conditionTreeGenerator);

          const aFilter = factories.filter.build({
            segment: 'segmentName',
            conditionTree: factories.conditionTreeLeaf.build({
              operator: Operator.Equal,
              value: 'otherNameValue',
              field: 'name',
            }),
          });
          const filter = await segmentDecorator.refineFilter(aFilter);

          expect(filter).toEqual({
            segment: null,
            conditionTree: {
              aggregator: 'and',
              conditions: [
                {
                  operator: 'equal',
                  field: 'name',
                  value: 'otherNameValue',
                },
                {
                  operator: 'equal',
                  field: 'name',
                  value: 'aNameValue',
                },
              ],
            },
          });
        });

        it('should throw an error when a conditionTree is not valid', async () => {
          const collection = factories.collection.build({
            name: 'book',
            schema: factories.collectionSchema.build({
              fields: {
                name: factories.columnSchema.build({}),
              },
            }),
          });
          segmentDecorator = new SegmentCollectionDecorator(collection, null);
          segmentDecorator.registerSegment('segmentName', conditionTreeGenerator);

          const aFilterWithNotValidConditionTree = factories.filter.build({
            segment: 'segmentName',
            conditionTree: factories.conditionTreeLeaf.build({
              operator: Operator.In,
              value: 'otherNameValue',
              field: 'name',
            }),
          });

          await expect(() =>
            segmentDecorator.refineFilter(aFilterWithNotValidConditionTree),
          ).rejects.toThrow();
        });
      });
    });
  });
});
