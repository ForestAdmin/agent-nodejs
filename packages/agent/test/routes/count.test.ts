import { FieldTypes, PrimitiveTypes, AggregationOperation } from '@forestadmin/datasource-toolkit';
import { Context } from 'koa';
import Count from '../../src/routes/count';
import * as factories from '../__factories__';

describe('Count', () => {
  const services = factories.forestAdminHttpDriverServices.build();
  const partialCollection = {
    name: 'books',
    aggregate: jest.fn(),
    schema: factories.collectionSchema.build({
      fields: {
        id: {
          type: FieldTypes.Column,
          columnType: PrimitiveTypes.Uuid,
          isPrimaryKey: true,
        },
      },
    }),
  };
  const dataSource = factories.dataSource.buildWithCollection(partialCollection);
  const options = factories.forestAdminHttpDriverOptions.build();
  const router = factories.router.mockAllMethods().build();

  beforeEach(() => {
    (router.get as jest.Mock).mockClear();
  });

  test('should register "/books/count" private routes', () => {
    const list = new Count(services, dataSource, options, partialCollection.name);
    list.setupPrivateRoutes(router);

    expect(router.get).toHaveBeenCalledWith('/books/count', expect.any(Function));
  });

  describe('handleCount', () => {
    test('should call the serializer using the aggregate implementation', async () => {
      services.serializer.serialize = jest.fn();
      const count = new Count(services, dataSource, options, partialCollection.name);
      const context = {
        request: {},
        response: {},
      } as Context;

      await count.handleCount(context);
      expect(partialCollection.aggregate).toHaveBeenCalledWith(
        {},
        { operation: AggregationOperation.Count },
      );
    });
  });
});
