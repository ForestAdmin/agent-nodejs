import {
  BaseDataSource,
  Caller,
  Chart,
  Collection,
  DataSource,
  DataSourceSchema,
} from '@forestadmin/datasource-toolkit';

export default class CompositeDatasource<
  T extends Collection = Collection,
> extends BaseDataSource<T> {
  private readonly datasourceChartMapping: { [chartName: string]: DataSource };

  constructor() {
    super();
    this.datasourceChartMapping = {};
  }

  addDataSource(dataSource: DataSource): CompositeDatasource {
    this.addCollections(dataSource);
    this.addCharts(dataSource);

    return this;
  }

  override get schema(): DataSourceSchema {
    return { charts: Object.keys(this.datasourceChartMapping) };
  }

  override renderChart(caller: Caller, name: string): Promise<Chart> {
    if (!this.datasourceChartMapping[name]) {
      throw new Error(`Chart '${name}' is not defined in the dataSource.`);
    }

    return this.datasourceChartMapping[name].renderChart(caller, name);
  }

  private addCollections(dataSource: DataSource): void {
    for (const collection of dataSource.collections) {
      this.addCollection(collection as T);
    }
  }

  private addCharts(dataSource: DataSource): void {
    for (const chartName of dataSource.schema.charts) {
      if (this.datasourceChartMapping[chartName]) {
        throw new Error(`Chart '${chartName}' is already defined in datasource.`);
      }

      this.datasourceChartMapping[chartName] = dataSource;
    }
  }
}
