// eslint-disable-next-line max-classes-per-file
import {
  AggregateResult,
  Aggregation,
  BaseCollection,
  Caller,
  ConditionTreeLeaf,
  DataSource,
  Filter,
  PaginatedFilter,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import { Model, PipelineStage } from 'mongoose';

import PipelineGenerator from './utils/pipeline-generator';
import SchemaFieldsGenerator from './utils/schema-fields-generator';

export default class MongooseCollection extends BaseCollection {
  public readonly model: Model<RecordData>;

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
    return this.model.aggregate(PipelineGenerator.find(this, this.model, filter, projection));
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
    let pipeline = PipelineGenerator.find(this, this.model, filter, aggregation.projection);
    pipeline = PipelineGenerator.group(aggregation, pipeline);
    if (limit) pipeline.push({ $limit: limit });

    return MongooseCollection.formatRecords(await this.model.aggregate(pipeline));
  }

  protected static formatRecords(records: RecordData[]): AggregateResult[] {
    const results: AggregateResult[] = [];

    records.forEach(record => {
      // eslint-disable-next-line no-underscore-dangle
      const group = Object.entries(record?._id || {}).reduce((memo, [field, value]) => {
        memo[field.replace(':', ':')] = value;

        return memo;
      }, {});

      results.push({ value: record.value, group });
    });

    return results;
  }

  protected parseJSONToNestedFieldsInPlace(data: RecordData[]) {
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

export class ManyToManyMongooseCollection extends MongooseCollection {
  private readonly originCollection: MongooseCollection;
  private readonly foreignCollection: MongooseCollection;

  constructor(
    dataSource: DataSource,
    model: Model<RecordData>,
    originCollectionName: MongooseCollection,
    foreignCollectionName: MongooseCollection,
  ) {
    super(dataSource, model);
    this.originCollection = originCollectionName;
    this.foreignCollection = foreignCollectionName;
  }

  override async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    const records = await this.createManyToMany(data);
    // eslint-disable-next-line no-underscore-dangle
    const ids = records.map(record => record._id);
    const conditionTree = new ConditionTreeLeaf('_id', 'In', ids);

    return this.list(caller, new Filter({ conditionTree }), new Projection());
  }

  override async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    const { model } = this.originCollection;

    return model.aggregate(this.buildListPipeline(model, filter, projection));
  }

  override async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    return this.updateManyToMany(caller, filter, patch);
  }

  override async delete(caller: Caller, filter: Filter): Promise<void> {
    return this.updateManyToMany(caller, filter);
  }

  override async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult[]> {
    const { model } = this.originCollection;
    let pipeline = this.buildListPipeline(model, filter, aggregation.projection);
    pipeline = PipelineGenerator.group(aggregation, pipeline);
    if (limit) pipeline.push({ $limit: limit });

    return MongooseCollection.formatRecords(await model.aggregate(pipeline));
  }

  protected async createManyToMany(data: RecordData[]): Promise<RecordData[]> {
    const [originCollectionName, foreignCollectionName] = this.name.split('__');
    const origin = this.dataSource.getCollection(originCollectionName) as MongooseCollection;
    const manyToManyFieldName = this.getManyToManyFieldName(origin, this.name);

    return Promise.all(
      data.map(item => {
        return origin.model.updateOne(
          { _id: item[`${originCollectionName}_id`] },
          {
            $addToSet: { [manyToManyFieldName]: item[`${foreignCollectionName}_id`] },
          },
        );
      }),
    );
  }

  protected async updateManyToMany(
    caller: Caller,
    filter: Filter,
    patch?: RecordData,
  ): Promise<void> {
    const [originCollectionName, foreignCollectionName] = this.name.split('__');
    const records = await this.list(
      caller,
      filter,
      new Projection(`${originCollectionName}_id`, `${foreignCollectionName}_id`),
    );

    for (const record of records) {
      const origin = this.dataSource.getCollection(originCollectionName) as MongooseCollection;
      const manyToManyFieldName = this.getManyToManyFieldName(origin, this.name);
      // improve by grouping by origin id
      // eslint-disable-next-line no-await-in-loop
      await origin.model.updateOne(
        { _id: record[`${originCollectionName}_id`] },
        {
          $pull: { [manyToManyFieldName]: record[`${foreignCollectionName}_id`] },
        },
      );

      if (patch) {
        // eslint-disable-next-line no-await-in-loop
        await origin.model.updateOne(
          { _id: patch[`${originCollectionName}_id`] },
          {
            $addToSet: { [manyToManyFieldName]: patch[`${foreignCollectionName}_id`] },
          },
        );
      }
    }
  }

  protected getManyToManyFieldName(
    collection: MongooseCollection,
    throughCollectionName: string,
  ): string {
    const schemas = Object.entries(collection.schema.fields);

    const fieldAndSchema = schemas.find(
      ([, s]) => s.type === 'ManyToMany' && s.throughCollection === throughCollectionName,
    );

    if (!fieldAndSchema) {
      throw new Error(`The '${throughCollectionName}' collection does not exist`);
    }

    return fieldAndSchema[0].split('__').slice(0, -2).join('.');
  }

  protected buildListPipeline(
    model: Model<RecordData>,
    filter: Filter,
    projection: Projection,
  ): PipelineStage[] {
    let pipeline: PipelineStage[] = [];

    const [originCollectionName, foreignCollectionName] = this.name.split('__');
    const origin = this.dataSource.getCollection(originCollectionName) as MongooseCollection;

    pipeline = PipelineGenerator.find(origin, model, new PaginatedFilter({}), new Projection());
    pipeline = PipelineGenerator.emulateManyToManyCollection(
      model,
      this.getManyToManyFieldName(origin, this.name),
      originCollectionName,
      foreignCollectionName,
      pipeline,
    );

    return PipelineGenerator.find(this, model, filter, projection, pipeline);
  }
}
