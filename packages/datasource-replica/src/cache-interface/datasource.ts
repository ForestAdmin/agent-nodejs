import type { Caller, DataSource } from '@forestadmin/datasource-toolkit';

import CacheCollectionInterface from './collection';

/** DataSource wrapper which accepts plain objects in all methods */
export default class CacheDataSourceInterface {
  private dataSource: DataSource;
  private caller: Caller = {
    id: 0,
    email: 'datasource-replica@forestadmin.com',
    firstName: 'Datasource',
    lastName: 'Replica',
    renderingId: 0,
    request: { ip: '::1' },
    role: 'system',
    tags: {},
    team: 'system',
    environment: null,
    project: null,
    timezone: 'UTC',
    permissionLevel: 'admin',
    requestId: '',
  };

  constructor(dataSource: DataSource) {
    this.dataSource = dataSource;
  }

  /**
   * Get a collection from a datasource
   * @param name the name of the collection
   */
  getCollection(name: string): CacheCollectionInterface {
    return new CacheCollectionInterface(this.dataSource.getCollection(name), this.caller);
  }
}
