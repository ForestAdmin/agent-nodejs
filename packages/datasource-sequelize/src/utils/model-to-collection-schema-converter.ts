import { CollectionSchema } from '@forestadmin/datasource-toolkit';

export default class ModelToCollectionSchemaConverter {
  public static convert(model): CollectionSchema {
    void model;

    // TODO: Implement it.
    return {
      actions: {},
      fields: {}, // FIXME: Via model.getAttributes();
      searchable: false,
      segments: [],
    };
  }
}
