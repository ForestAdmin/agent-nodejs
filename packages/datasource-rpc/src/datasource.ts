import { BaseDataSource, CollectionSchema } from '@forestadmin/datasource-toolkit';
import { QueryFn } from './types';
import RpcCollection from './collection';

export default class RpcDataSource extends BaseDataSource {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  constructor(query: QueryFn, handshake: any) {
    super();

    Object.assign(this.schema, handshake.dataSourceSchema);

    for (const [name, schema] of Object.entries(handshake.collectionSchemas)) {
      this.addCollection(new RpcCollection(name, this, query, schema as CollectionSchema));
    }
  }
}
