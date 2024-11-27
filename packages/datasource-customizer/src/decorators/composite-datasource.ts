import {
  Caller,
  Chart,
  Collection,
  DataSource,
  DataSourceSchema,
  MissingCollectionError,
} from '@forestadmin/datasource-toolkit';

export default class CompositeDatasource<T extends Collection = Collection>
  implements DataSource<T>
{
  private dataSources: DataSource[] = [];

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
    for (const collection of this.dataSources) {
      try {
        return collection.getCollection(name) as T;
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
    for (const collection of dataSource.collections) {
      if (this.collections.some(c => c.name === collection.name)) {
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
  }

  async renderChart(caller: Caller, name: string): Promise<Chart> {
    for (const dataSource of this.dataSources) {
      if (dataSource.schema.charts.includes(name)) {
        return dataSource.renderChart(caller, name);
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
