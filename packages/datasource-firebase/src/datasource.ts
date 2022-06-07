import { BaseDataSource, Logger } from '@forestadmin/datasource-toolkit';
import { FieldSchema } from './schema';
import FirebaseCollection from './collection';

export default class FirebaseDatasource extends BaseDataSource<FirebaseCollection> {
  protected constructor(private readonly logger?: Logger) {
    super();
  }

  public static create({
    schema,
    logger,
  }: {
    schema: Record<string, Record<string, FieldSchema>>;
    logger?: Logger;
  }): FirebaseDatasource {
    const datasource = new FirebaseDatasource(logger);

    Object.entries(schema).forEach(([collectionName, collectionSchema]) => {
      const collection = FirebaseCollection.create({
        name: collectionName,
        schema: collectionSchema,
        datasource,
        logger,
      });

      datasource.addCollection(collection);
    });

    return datasource;
  }
}
