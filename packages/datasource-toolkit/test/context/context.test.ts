import * as factories from '../__factories__';
import { Collection } from '../../src/interfaces/collection';
import CollectionCustomizationContext from '../../src/context/collection-context';
import RelaxedCollection from '../../src/context/relaxed-wrappers/collection';
import RelaxedDataSource from '../../src/context/relaxed-wrappers/datasource';

describe('Context', () => {
  let collection: Collection;
  let context: CollectionCustomizationContext;
  beforeEach(() => {
    collection = factories.collection.build();
    context = new CollectionCustomizationContext(collection, 'Europe/Paris');
  });

  test('context datasource should wrapped', () => {
    expect(context.dataSource).toBeInstanceOf(RelaxedDataSource);
  });

  test('context collection should wrapped', () => {
    expect(context.collection).toBeInstanceOf(RelaxedCollection);
  });

  test('context should keep timezone', () => {
    expect(context.timezone).toBe('Europe/Paris');
  });
});
