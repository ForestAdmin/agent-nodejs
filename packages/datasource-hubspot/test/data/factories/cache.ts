import { DataSource, Filter, Projection } from '@forestadmin/datasource-toolkit';
import * as factories from '@forestadmin/datasource-toolkit/dist/test/__factories__';

export default class Cache {
  static async getAllRecords(
    datasource: DataSource,
    collectionName: string,
    fields: string[] = [],
  ) {
    return datasource
      .getCollection(collectionName)
      .list(factories.caller.build(), new Filter({}), new Projection(...fields));
  }
}
