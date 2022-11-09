// eslint-disable-next-line max-classes-per-file
import { Factory } from 'fishery';

import Collection from '../../src/implementations/collection/collection';
import { ActionField } from '../../src/interfaces/action';
import { ActionSchema } from '../../src/interfaces/schema';
import collectionSchemaFactory from './schema/collection-schema';

export class CollectionFactory extends Factory<Collection> {
  buildWithAction(name: string, schema: ActionSchema, fields: ActionField[] = null): Collection {
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

export default CollectionFactory.define(() => {
  return new (class extends Collection {
    dataSource = null;
    name = 'a collection';
    schema = collectionSchemaFactory.build();
    execute = jest.fn();
    getForm = jest.fn();
    renderChart = jest.fn();
    create = jest.fn();
    list = jest.fn();
    update = jest.fn();
    delete = jest.fn();
    aggregate = jest.fn();
  })();
});
