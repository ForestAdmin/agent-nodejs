import { Factory } from 'fishery';
import { ActionForm } from '../../src/interfaces/action';
import { Collection } from '../../src/interfaces/collection';
import { ActionSchema } from '../../src/interfaces/schema';
import collectionSchemaFactory from './schema/collection-schema';

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
