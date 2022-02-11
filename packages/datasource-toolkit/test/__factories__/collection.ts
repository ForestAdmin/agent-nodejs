// eslint-disable-next-line max-classes-per-file
import { Factory } from 'fishery';

import { ActionForm } from '../../src/interfaces/action';
import { ActionSchema, CollectionSchema } from '../../src/interfaces/schema';
import { Collection, DataSource } from '../../src/interfaces/collection';
import CollectionDecorator from '../../src/decorators/collection-decorator';
import PaginatedFilter from '../../src/interfaces/query/filter/paginated';
import collectionSchemaFactory from './schema/collection-schema';

export class DecoratedCollection extends CollectionDecorator {
  public override childCollection: Collection;

  public override async refineFilter(filter: PaginatedFilter): Promise<PaginatedFilter> {
    return super.refineFilter(filter);
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

  buildDecoratedCollection(
    partialCollection?: Partial<Collection>,
    dataSource: DataSource = null,
  ): DecoratedCollection {
    return new DecoratedCollection(this.build(partialCollection), dataSource);
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
