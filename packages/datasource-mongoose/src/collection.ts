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

  public static formatRecords(records: RecordData[]): AggregateResult[] {
    const results: AggregateResult[] = [];

    records.forEach(record => {
      // eslint-disable-next-line no-underscore-dangle
      const group = Object.entries(record?._id || {}).reduce((computed, [field, value]) => {
        computed[field] = value;

        return computed;
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

export class ManyToManyMongooseCollection extends MongooseCollection {
  private readonly originCollection: MongooseCollection;
  private readonly foreignCollection: MongooseCollection;
  private readonly fieldNameOfIds: string;

  constructor(
    dataSource: DataSource,
    model: Model<RecordData>,
    originCollectionName: MongooseCollection,
    foreignCollectionName: MongooseCollection,
    fieldNameOfIds: string,
  ) {
    super(dataSource, model);
    this.originCollection = originCollectionName;
    this.foreignCollection = foreignCollectionName;
    this.fieldNameOfIds = fieldNameOfIds;
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

  private async createManyToMany(data: RecordData[]): Promise<RecordData[]> {
    return Promise.all(
      data.map(item => {
        return this.originCollection.model.updateOne(
          { _id: item[`${this.originCollection.name}_id`] },
          {
            $addToSet: { [this.fieldNameOfIds]: item[`${this.foreignCollection.name}_id`] },
          },
        );
      }),
    );
  }

  private async updateManyToMany(
    caller: Caller,
    filter: Filter,
    patch?: RecordData,
  ): Promise<void> {
    const records = await this.list(
      caller,
      filter,
      new Projection(`${this.originCollection.name}_id`, `${this.foreignCollection.name}_id`),
    );

    for (const record of records) {
      // improve by grouping by origin id
      // eslint-disable-next-line no-await-in-loop
      await this.originCollection.model.updateOne(
        { _id: record[`${this.originCollection.name}_id`] },
        {
          $pull: { [this.fieldNameOfIds]: record[`${this.foreignCollection.name}_id`] },
        },
      );

      if (patch) {
        // eslint-disable-next-line no-await-in-loop
        await this.originCollection.model.updateOne(
          { _id: patch[`${this.originCollection.name}_id`] },
          {
            $addToSet: { [this.fieldNameOfIds]: patch[`${this.foreignCollection.name}_id`] },
          },
        );
      }
    }
  }

  private buildListPipeline(
    model: Model<RecordData>,
    filter: Filter,
    projection: Projection,
  ): PipelineStage[] {
    const allFilter = new PaginatedFilter({});
    const allProjection = new Projection();
    let pipeline = PipelineGenerator.find(this.originCollection, model, allFilter, allProjection);
    pipeline = PipelineGenerator.emulateManyToManyCollection(
      model,
      this.fieldNameOfIds,
      this.originCollection.name,
      this.foreignCollection.name,
      pipeline,
    );

    return PipelineGenerator.find(this, model, filter, projection, pipeline);
  }
}
