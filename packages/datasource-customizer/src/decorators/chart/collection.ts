import { Caller, Chart, CollectionSchema, CompositeId } from '@forestadmin/datasource-toolkit';

import CollectionChartContext from './context';
import ResultBuilder from './result-builder';
import { CollectionChartDefinition } from './types';
import CollectionDecorator from '../collection-decorator';

export default class ChartCollectionDecorator extends CollectionDecorator {
  private charts: Record<string, CollectionChartDefinition> = {};

  addChart(name: string, definition: CollectionChartDefinition) {
    if (this.schema.charts.includes(name)) {
      throw new Error(`Chart '${name}' already exists.`);
    }

    this.charts[name] = definition;
    this.markSchemaAsDirty();
  }

  override async renderChart(caller: Caller, name: string, recordId: CompositeId): Promise<Chart> {
    if (this.charts[name]) {
      const context = new CollectionChartContext(this, caller, recordId);
      const resultBuilder = new ResultBuilder();

      return this.charts[name](context, resultBuilder);
    }

    return this.childCollection.renderChart(caller, name, recordId);
  }

  protected override refineSchema(subSchema: CollectionSchema): CollectionSchema {
    return {
      ...subSchema,
      charts: [...subSchema.charts, ...Object.keys(this.charts)],
    };
  }
}
