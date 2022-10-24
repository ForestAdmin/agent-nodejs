import { Caller, Chart, DataSource, DataSourceSchema } from '@forestadmin/datasource-toolkit';
import { ChartDefinition } from './types';
import AgentCustomizationContext from '../../context/agent-context';
import ChartCollectionDecorator from './collection';
import DataSourceDecorator from '../datasource-decorator';
import ResultBuilder from './result-builder';

export default class ChartDataSourceDecorator extends DataSourceDecorator<ChartCollectionDecorator> {
  private charts: Record<string, ChartDefinition> = {};

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

  addChart(name: string, definition: ChartDefinition) {
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
