import * as factories from '../__factories__';
import { Collection } from '../../src/interfaces/collection';
import { QueryRecipient } from '../../src';
import CollectionCustomizationContext from '../../src/context/collection-context';
import RelaxedCollection from '../../src/context/relaxed-wrappers/collection';
import RelaxedDataSource from '../../src/context/relaxed-wrappers/datasource';

describe('Context', () => {
  let collection: Collection;
  let recipient: QueryRecipient;
  let context: CollectionCustomizationContext;

  beforeEach(() => {
    collection = factories.collection.build();
    recipient = factories.recipient.build();
    context = new CollectionCustomizationContext(collection, recipient);
  });

  test('context datasource should wrapped', () => {
    expect(context.dataSource).toBeInstanceOf(RelaxedDataSource);
  });

  test('context collection should wrapped', () => {
    expect(context.collection).toBeInstanceOf(RelaxedCollection);
  });

  test('context should keep recipient', () => {
    expect(context.recipient).toBe(recipient);
  });
});
