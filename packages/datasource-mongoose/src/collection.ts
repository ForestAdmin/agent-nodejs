import {
  AggregateResult,
  Aggregation,
  BaseCollection,
  Caller,
  Collection,
  ConditionTreeLeaf,
  DataSource,
  Filter,
  PaginatedFilter,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import { Model, PipelineStage, SchemaType } from 'mongoose';

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
    let pipeline: PipelineStage[];
    let model;

    if (this.isManyToManyCollection(this)) {
      const [originName, foreignName] = this.name.split('_');
      const collection = this.dataSource.getCollection(originName) as MongooseCollection;
      const updatedFilter = new PaginatedFilter({});
      const updatedProjection = new Projection();
      model = collection.model;
      pipeline = PipelineGenerator.find(collection, model, updatedFilter, updatedProjection);

      const fieldName = this.getManyToManyFieldName(collection, this.name);
      pipeline.push({ $unwind: `$${fieldName}` });
      pipeline.push({
        $addFields: {
          [`${originName}_id`]: '$_id',
          [`${foreignName}_id`]: `$${fieldName}`,
          _id: { $concat: [{ $toString: '$_id' }, '-', { $toString: `$${fieldName}` }] },
        },
      });
      pipeline.push({
        $project: { _id: true, [`${originName}_id`]: true, [`${foreignName}_id`]: true },
      });
      pipeline = PipelineGenerator.find(this, model, filter, projection, pipeline);
    } else {
      model = this.model;
      pipeline = PipelineGenerator.find(this, model, filter, projection);
    }

    return model.aggregate(pipeline);
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
    pipeline.push(PipelineGenerator.group(aggregation));

    if (limit) {
      pipeline.push({ $limit: limit });
    }

    return MongooseCollection.formatRecords(await this.model.aggregate(pipeline));
  }

  private isManyToManyCollection(collection: MongooseCollection): boolean {
    return !!collection.dataSource.collections.find(col => {
      const schemas = Object.values(col.schema.fields);

      return schemas.find(s => s.type === 'ManyToMany' && s.throughCollection === collection.name);
    });
  }

  private getManyToManyFieldName(
    collection: MongooseCollection,
    throughCollectionName: string,
  ): string {
    const schemas = Object.entries(collection.schema.fields);

    const fieldAndSchema = schemas.find(
      ([, s]) => s.type === 'ManyToMany' && s.throughCollection === throughCollectionName,
    );

    return fieldAndSchema ? fieldAndSchema[0].split('_').slice(0, -1).join('.') : null;
  }

  private static formatRecords(records: RecordData[]): AggregateResult[] {
    const results: AggregateResult[] = [];

    records.forEach(record => {
      // eslint-disable-next-line no-underscore-dangle
      const group = Object.entries(record?._id || {}).reduce((memo, [field, value]) => {
        memo[field.replace(':', '.')] = value;

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
