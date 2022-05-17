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

import Aggregation, {
  DateOperation,
} from '@forestadmin/datasource-toolkit/dist/src/interfaces/query/aggregation';
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

    aggregation.groups.forEach(group => {
      if (
        aggregation.operation === 'Sum' ||
        aggregation.operation === 'Avg' ||
        aggregation.operation === 'Count'
      ) {
        const aggregationOperation: Record<string, string> = {
          Sum: '$sum',
          Avg: '$avg',
          Count: '$sum',
        };

        const groupOperation: Record<string, string> = {
          Year: '$year',
          Month: '$month',
          Day: '$dayOfMonth',
          Week: '$week',
        };

        const computedGroup = {
          $group: {
            value: undefined,
            _id: undefined,
          },
        };

        if (group.operation) {
          // eslint-disable-next-line no-underscore-dangle
          computedGroup.$group._id = {
            [groupOperation[group.operation]]: `$${group.field}`,
          };
        } else {
          // eslint-disable-next-line no-underscore-dangle
          computedGroup.$group._id = `$${group.field}`;
        }

        if (aggregation.operation) {
          let value: unknown = `$${aggregation.field}`;
          if (aggregation.operation === 'Count') value = { $cond: [{ $ne: [value, null] }, 1, 0] };

          computedGroup.$group.value = {
            [aggregationOperation[aggregation.operation]]: value,
          };
        }

        pipeline.push(computedGroup);
      }
    });

    const records = await this.model.aggregate(pipeline);

    return MongooseCollection.formatRecords(records, aggregation);
  }

  private static formatRecords(records: RecordData[], aggregation: Aggregation): AggregateResult[] {
    const results: AggregateResult[] = [];

    records.forEach(record => {
      const group = aggregation.groups.reduce((memo, g) => {
        // eslint-disable-next-line no-underscore-dangle
        memo[g.field] = record._id;

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
