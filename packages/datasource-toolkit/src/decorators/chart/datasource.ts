import { Caller } from '../../interfaces/caller';
import { Chart } from '../../interfaces/chart';
import { ChartDefinition } from './types';
import { DataSource } from '../../interfaces/collection';
import { DataSourceSchema } from '../../interfaces/schema';
import AgentCustomizationContext from '../../context/agent-context';
import CollectionDecorator from '../collection-decorator';
import DataSourceDecorator from '../datasource-decorator';
import ResultBuilder from './result-builder';

export default class ChartDataSourceDecorator extends DataSourceDecorator {
  private charts: Record<string, ChartDefinition> = {};

  override get schema(): DataSourceSchema {
    return {
      ...this.childDataSource.schema,
      charts: [...this.childDataSource.schema.charts, ...Object.keys(this.charts)],
    };
  }

  constructor(childDataSource: DataSource) {
    super(childDataSource, CollectionDecorator);
  }

  addChart(name: string, definition: ChartDefinition) {
    this.charts[name] = definition;
  }

  override async renderChart(caller: Caller, name: string): Promise<Chart> {
    if (!this.charts[name]) {
      return super.renderChart(caller, name);
    }

    return this.charts[name](new AgentCustomizationContext(this, caller), new ResultBuilder());
  }
}
