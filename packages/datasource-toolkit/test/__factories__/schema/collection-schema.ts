/* eslint-disable max-classes-per-file */
import { Factory } from 'fishery';

import CollectionSchema from '../../../src/collection-schema';

export class CollectionSchemaFactory extends Factory<CollectionSchema> {
  unsearchable(): CollectionSchemaFactory {
    return this.params({ searchable: false });
  }
}

export default CollectionSchemaFactory.define(
  () =>
    new (class extends CollectionSchema {
      override actions = {};
      override countable = true;
      override charts = [];
      override fields = {};
      override searchable = true;
      override segments = [];
    })(),
);
