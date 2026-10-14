import type {
  Caller,
  Chart,
  Collection,
  DataSource,
  DataSourceSchema,
} from '@forestadmin/datasource-toolkit';

import { MissingCollectionError } from '@forestadmin/datasource-toolkit';

export default class CompositeDatasource<T extends Collection = Collection>
  implements DataSource<T>
{
  private dataSources: DataSource[] = [];
  private dataSourceByCollectionName = new Map<string, DataSource>();

  get nativeQueryConnections(): Record<string, unknown> {
    return this.dataSources.reduce(
      (acc, current) => ({ ...acc, ...current.nativeQueryConnections }),
      {},
    );
  }

  get schema(): DataSourceSchema {
    return { charts: this.dataSources.flatMap(dataSource => dataSource.schema.charts) };
  }

  get collections(): T[] {
    return this.dataSources.flatMap(dataSource => dataSource.collections) as T[];
  }

  getCollection(name: string): T {
    const knownDataSource = this.dataSourceByCollectionName.get(name);
    if (knownDataSource) return knownDataSource.getCollection(name) as T;

    for (const dataSource of this.dataSources) {
      try {
        const collection = dataSource.getCollection(name) as T;
        this.dataSourceByCollectionName.set(name, dataSource);

        return collection;
      } catch (error) {
        // Ignore
      }
    }

    throw new MissingCollectionError(
      `Collection '${name}' not found. List of available collections: ${this.collections
        .map(c => c.name)
        .sort()
        .join(', ')}`,
    );
  }

  addDataSource(dataSource: DataSource): void {
    const existingNames = new Set(this.collections.map(c => c.name));

    for (const collection of dataSource.collections) {
      if (existingNames.has(collection.name)) {
        throw new Error(`Collection '${collection.name}' already exists`);
      }
    }

    for (const chart of dataSource.schema.charts) {
      if (this.schema.charts.includes(chart)) {
        throw new Error(`Chart '${chart}' is already defined in datasource.`);
      }
    }

    for (const nativeQueryConnection of Object.keys(dataSource.nativeQueryConnections || {})) {
      if (this.nativeQueryConnections[nativeQueryConnection]) {
        throw new Error(`Native Query connection '${nativeQueryConnection}' is already defined`);
      }
    }

    this.dataSources.push(dataSource);

    for (const collection of dataSource.collections) {
      this.dataSourceByCollectionName.set(collection.name, dataSource);
    }
  }

  async renderChart(
    caller: Caller,
    name: string,
    parameters?: Record<string, string>,
  ): Promise<Chart> {
    for (const dataSource of this.dataSources) {
      if (dataSource.schema.charts.includes(name)) {
        return dataSource.renderChart(caller, name, parameters);
      }
    }

    throw new Error(`Chart '${name}' is not defined in the dataSource.`);
  }

  async executeNativeQuery(
    connectionName: string,
    query: string,
    contextVariables = {},
  ): Promise<unknown> {
    if (!this.nativeQueryConnections[connectionName]) {
      throw new Error(`Unknown connection name '${connectionName}'`);
    }

    return this.dataSources
      .find(datasource => Boolean(datasource.nativeQueryConnections[connectionName]))
      .executeNativeQuery(connectionName, query, contextVariables);
  }
}
