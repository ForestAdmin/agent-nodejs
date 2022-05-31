/* eslint-disable no-underscore-dangle */
import {
  AggregateResult,
  Aggregation,
  Caller,
  ConditionTreeLeaf,
  Filter,
  ManyToManySchema,
  PaginatedFilter,
  Projection,
  RecordData,
} from '@forestadmin/datasource-toolkit';
import { Model, PipelineStage, Schema, model as mongooseModel } from 'mongoose';

import MongooseCollection from './collection';
import PipelineGenerator from '../utils/pipeline-generator';

export default class ManyToManyMongooseCollection extends MongooseCollection {
  private readonly originCollection: MongooseCollection;
  private readonly foreignCollection: MongooseCollection;
  private readonly originFieldNameOfIds: string;

  constructor(
    originCollection: MongooseCollection,
    foreignCollection: MongooseCollection,
    originFieldNameOfIds: string,
    manyToManyRelation: string,
  ) {
    const model = ManyToManyMongooseCollection.buildModel(
      originCollection,
      foreignCollection,
      manyToManyRelation,
    );

    super(originCollection.dataSource, model);
    this.originCollection = originCollection;
    this.foreignCollection = foreignCollection;
    this.originFieldNameOfIds = originFieldNameOfIds;
  }

  override async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    const records = await this.createManyToMany(data);
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
            $addToSet: { [this.originFieldNameOfIds]: item[`${this.foreignCollection.name}_id`] },
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
          $pull: { [this.originFieldNameOfIds]: record[`${this.foreignCollection.name}_id`] },
        },
      );

      if (patch) {
        // eslint-disable-next-line no-await-in-loop
        await this.originCollection.model.updateOne(
          { _id: patch[`${this.originCollection.name}_id`] },
          {
            $addToSet: { [this.originFieldNameOfIds]: patch[`${this.foreignCollection.name}_id`] },
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
      this.originFieldNameOfIds,
      this.originCollection.name,
      this.foreignCollection.name,
      pipeline,
    );

    return PipelineGenerator.find(this, model, filter, projection, pipeline);
  }

  private static buildModel(
    originCollection: MongooseCollection,
    foreignCollection: MongooseCollection,
    manyToManyRelation: string,
  ): Model<RecordData> {
    const { foreignKey, originKey, throughCollection } = foreignCollection.schema.fields[
      manyToManyRelation
    ] as ManyToManySchema;
    const schema = new Schema(
      {
        [foreignKey]: { type: Schema.Types.ObjectId, ref: originCollection.name },
        [originKey]: { type: Schema.Types.ObjectId, ref: foreignCollection.name },
      },
      { _id: false },
    );

    return mongooseModel(throughCollection, schema, null, { overwriteModels: true });
  }
}
