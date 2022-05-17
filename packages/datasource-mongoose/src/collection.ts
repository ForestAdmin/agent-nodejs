import { Aggregate, Model } from 'mongoose';
import {
  AggregateResult,
  BaseCollection,
  Caller,
  ConditionTreeLeaf,
  DataSource,
  Filter,
  PaginatedFilter,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';

import Aggregation from '@forestadmin/datasource-toolkit/dist/src/interfaces/query/aggregation';
import PipelineGenerator from './utils/pipeline-generator';
import SchemaFieldsGenerator from './utils/schema-fields-generator';

export default class MongooseCollection extends BaseCollection {
  private readonly model: Model<RecordData>;

  constructor(dataSource: DataSource, model: Model<RecordData>) {
    super(model.modelName, dataSource);
    this.model = model;
    this.addFields(SchemaFieldsGenerator.buildFieldsSchema(model));
  }

  async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    this.parseJSONToNestedFieldsInPlace(data);
    const records = await this.model.insertMany(data);
    // eslint-disable-next-line no-underscore-dangle
    const ids = records.map(record => record._id);
    const conditionTree = new ConditionTreeLeaf('_id', 'In', ids);

    return this.list(caller, new Filter({ conditionTree }), new Projection());
  }

  async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    const pipeline = PipelineGenerator.find(this, this.model, filter, projection);

    return this.model.aggregate(pipeline);
  }

  async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    const ids = await this.list(caller, filter, new Projection('_id'));
    // eslint-disable-next-line no-underscore-dangle
    await this.model.updateMany({ _id: ids.map(record => record._id) }, patch);
  }

  async delete(caller: Caller, filter: Filter): Promise<void> {
    const ids = await this.list(caller, filter, new Projection('_id'));
    // eslint-disable-next-line no-underscore-dangle
    await this.model.deleteMany({ _id: ids.map(record => record._id) });
  }

  async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    const pipeline = PipelineGenerator.find(this, this.model, filter, aggregation.projection);

    if (aggregation.operation === 'Sum') {
      aggregation.groups.forEach(group => {
        pipeline.push({
          $group: {
            _id: {
              $year: '$createdDate',
            },
            value: { $sum: '$rating' },
          },
        });
      });
    } else if (aggregation.operation === 'Count') {
      aggregation.groups.forEach(group => {
        pipeline.push({
          $group: {
            _id: `$${group.field}`,
            value: { $count: {} },
          },
        });
      });
    }

    const records = await this.model.aggregate(pipeline);

    return MongooseCollection.formatRecords(records, aggregation);
  }

  private static formatRecords(records: RecordData[], aggregation: Aggregation): AggregateResult[] {
    const results: AggregateResult[] = [];

    records.forEach(record => {
      const group = aggregation.groups.reduce((memo, g) => {
        if (g.operation === 'Year') {
          // eslint-disable-next-line no-underscore-dangle
          memo[g.field] = new Date(record._id.toString());
        } else {
          // eslint-disable-next-line no-underscore-dangle
          memo[g.field] = record._id;
        }

        return memo;
      }, {});

      results.push({ value: record.value, group });
    });

    return results;
  }

  private parseJSONToNestedFieldsInPlace(data: RecordData[]) {
    data.forEach(currentData => {
      Object.entries(this.schema.fields).forEach(([fieldName, schema]) => {
        if (schema.type === 'Column' && typeof schema.columnType === 'object') {
          if (typeof currentData[fieldName] === 'string') {
            currentData[fieldName] = JSON.parse(<string>currentData[fieldName]);
          }
        }
      });
    });
  }
}
