// eslint-disable-next-line max-classes-per-file
import { Factory } from 'fishery';
import { ActionForm } from '../../src/interfaces/action';
import { Collection } from '../../src/interfaces/collection';
import { ActionSchema, CollectionSchema } from '../../src/interfaces/schema';
import { Filter } from '../../src/interfaces/query/selection';
import collectionSchemaFactory from './schema/collection-schema';
import CollectionDecorator from '../../src/decorators/collection-decorator';

export class DecoratedCollection extends CollectionDecorator {
  public refineFilter(filter: Filter): Filter {
    return filter;
  }

  public override refineSchema(subSchema: CollectionSchema): CollectionSchema {
    return subSchema;
  }
}

export class CollectionFactory extends Factory<Collection> {
  buildWithAction(name: string, schema: ActionSchema, form: ActionForm = null): Collection {
    return this.build({
      name: 'books',
      schema: collectionSchemaFactory.build({
        actions: { [name]: schema },
      }),
      getAction: jest.fn().mockReturnValue({
        execute: jest.fn(),
        getForm: jest.fn().mockReturnValue(Promise.resolve(form)),
      }),
    });
  }

  buildDecoratedCollection(partialCollection?: Partial<Collection>): DecoratedCollection {
    return new DecoratedCollection(this.build(partialCollection));
  }
}

export default CollectionFactory.define(() => ({
  dataSource: null,
  name: 'a collection',
  schema: collectionSchemaFactory.build(),
  getAction: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  list: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  aggregate: jest.fn(),
}));
