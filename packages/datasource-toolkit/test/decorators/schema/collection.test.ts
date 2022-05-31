import * as factories from '../../__factories__';
import SchemaCollectionDecorator from '../../../src/decorators/schema/collection';

describe('SchemaCollectionDecorator', () => {
  it('should overwrite fields from the schema', async () => {
    const collection = factories.collection.build({
      schema: factories.collectionSchema.build({ countable: true }),
    });

    const decorator = new SchemaCollectionDecorator(collection, null);
    decorator.overrideSchema({ countable: false });

    expect(collection.schema.countable).toBe(true);
    expect(decorator.schema.countable).toBe(false);
  });
});
