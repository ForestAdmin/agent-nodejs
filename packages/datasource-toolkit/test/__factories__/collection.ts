// eslint-disable-next-line max-classes-per-file

import type { ActionFormElement } from '../../src/interfaces/action';
import type { Collection } from '../../src/interfaces/collection';
import type { ActionSchema } from '../../src/interfaces/schema';

import { Factory } from 'fishery';

import collectionSchemaFactory from './schema/collection-schema';

export class CollectionFactory extends Factory<Collection> {
  buildWithAction(
    name: string,
    schema: ActionSchema,
    fields: ActionFormElement[] = null,
  ): Collection {
    return this.build({
      name: 'books',
      schema: collectionSchemaFactory.build({
        actions: { [name]: schema },
      }),
      execute: jest.fn(),
      getForm: jest.fn().mockReturnValue(Promise.resolve(fields)),
    });
  }
}

export default CollectionFactory.define(() => ({
  nativeDriver: null,
  dataSource: null,
  name: 'a collection',
  schema: collectionSchemaFactory.build(),
  execute: jest.fn(),
  getForm: jest.fn(),
  renderChart: jest.fn(),
  create: jest.fn().mockImplementation((caller, records) => Promise.resolve(records)),
  list: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  aggregate: jest.fn(),
}));
