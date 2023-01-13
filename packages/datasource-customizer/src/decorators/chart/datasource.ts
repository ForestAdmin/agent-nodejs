import { Caller, Chart, DataSource, DataSourceSchema } from '@forestadmin/datasource-toolkit';

import ChartCollectionDecorator from './collection';
import ResultBuilder from './result-builder';
import { DataSourceChartDefinition } from './types';
import AgentCustomizationContext from '../../context/agent-context';
import DataSourceDecorator from '../datasource-decorator';

export default class ChartDataSourceDecorator extends DataSourceDecorator<ChartCollectionDecorator> {
  private charts: Record<string, DataSourceChartDefinition> = {};

  override get schema(): DataSourceSchema {
    const myCharts = Object.keys(this.charts);
    const otherCharts = this.childDataSource.schema.charts;

    const duplicate = myCharts.find(name => otherCharts.includes(name));
    if (duplicate) throw new Error(`Chart '${duplicate}' is defined twice.`);

    return { ...this.childDataSource.schema, charts: [...myCharts, ...otherCharts] };
  }

  constructor(childDataSource: DataSource) {
    super(childDataSource, ChartCollectionDecorator);
  }

  addChart(name: string, definition: DataSourceChartDefinition) {
    if (this.schema.charts.includes(name)) {
      throw new Error(`Chart '${name}' already exists.`);
    }

    this.charts[name] = definition;
  }

  override async renderChart(caller: Caller, name: string): Promise<Chart> {
    const chartDefinition = this.charts[name];

    if (chartDefinition) {
      return chartDefinition(new AgentCustomizationContext(this, caller), new ResultBuilder());
    }

    return super.renderChart(caller, name);
  }
}
