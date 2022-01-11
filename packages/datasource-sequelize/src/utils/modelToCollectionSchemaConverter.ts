import { CollectionSchema } from '@forestadmin/datasource-toolkit';

export default class ModelToCollectionSchemaConverter {
  public static convert(model): CollectionSchema {
    // TODO: Implement it.
    return model.getAttributes();
  }
}
