import { Collection, Filter } from '../index';

export default abstract class CollectionDecorator {
  protected collection: Collection;

  constructor(collection: Collection) {
    this.collection = collection;
  }

  protected abstract refineFilter(filter: Filter): Filter;
}
