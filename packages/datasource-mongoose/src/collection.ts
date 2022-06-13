/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable no-underscore-dangle */
import {
  AggregateResult,
  Aggregation,
  BaseCollection,
  Caller,
  DataSource,
  Filter,
  PaginatedFilter,
  Projection,
  RecordData,
  TSchema,
  ValidationError,
} from '@forestadmin/datasource-toolkit';
import { Model, PipelineStage } from 'mongoose';

import { compareIds, escape, groupIdsByPath, replaceMongoTypes, splitId } from './utils/helpers';
import FieldsGenerator from './utils/schema/fields';
import FilterGenerator from './utils/pipeline/filter';
import GroupGenerator from './utils/pipeline/group';
import LookupGenerator from './utils/pipeline/lookup';
import MongooseSchema from './mongoose/schema';
import ProjectionGenerator from './utils/pipeline/projection';
import ReparentGenerator from './utils/pipeline/reparent';
import VirtualFieldsGenerator from './utils/pipeline/virtual-fields';

export default class MongooseCollection extends BaseCollection {
  model: Model<RecordData>;
  prefix: string;
  ignoreFields: string[];

  constructor(
    dataSource: DataSource,
    model: Model<RecordData>,
    prefix: string = null,
    ignoreFields: string[] = [],
  ) {
    super(prefix ? escape(`${model.modelName}.${prefix}`) : model.modelName, dataSource);
    this.model = model;
    this.prefix = prefix;
    this.ignoreFields = ignoreFields;

    this.enableCount();
    this.addFields(FieldsGenerator.buildFieldsSchema(model, prefix, ignoreFields));
  }

  async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    // If there is no prefix, we can delegate the work to mongoose directly.
    if (!this.prefix) {
      const { insertedIds } = await this.model.insertMany(data, { rawResult: true });

      return data.map((record, index) => ({ _id: insertedIds[index], ...record }));
    }

    // Transform list of subrecords to a list of modifications that we'll apply to the root record.
    const fieldName = this.prefix.substring(this.prefix.lastIndexOf('.') + 1);
    const schema = MongooseSchema.fromModel(this.model).getSubSchema(this.prefix);
    const updates: Map<unknown, { path: string; records: unknown[] }> = new Map();
    const results = [];

    for (const record of data) {
      const { _pid, ...rest } = record;
      if (!_pid) throw new ValidationError('Trying to create a subrecord with no parent');

      const [rootId, path] = splitId(`${_pid}.${fieldName}`);
      if (!updates.has(rootId)) updates.set(rootId, { path, records: [] });

      // unwrap 'content' on leafs
      updates.get(rootId).records.push(schema.isLeaf ? rest.content : rest);

      results.push({
        _id: schema.isArray // arrays have indexes in their ids
          ? `${rootId}.${path}.${updates.get(rootId).records.length - 1}`
          : `${rootId}.${path}`,
        ...record,
      });
    }

    // Apply the modifications to the root document.
    const promises = [...updates.entries()].map(async ([rootId, { path, records }]) =>
      this.model.updateOne(
        { _id: rootId },
        schema.isArray
          ? { $push: { [path]: { $each: records, position: 0 } } }
          : { $set: { [path]: records[0] } },
        { rawResult: true },
      ),
    );

    await Promise.all(promises);

    return results;
  }

  async list(
    caller: Caller,
    filter: PaginatedFilter,
    projection: Projection,
  ): Promise<RecordData[]> {
    const lookupProjection = projection.union(
      filter.conditionTree?.projection,
      filter.sort?.projection,
    );

    const records = await this.model.aggregate([
      ...this.buildBasePipeline(filter, lookupProjection),
      ...ProjectionGenerator.project(projection),
    ]);

    return replaceMongoTypes(records);
  }

  async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    const records = await this.list(caller, filter, new Projection('_id'));
    const ids = records.map(record => record._id);

    if (!this.prefix) {
      return this.model.updateMany({ _id: ids }, patch, { rawResult: true }).then(() => {});
    }

    // Clean patch
    const schema = MongooseSchema.fromModel(this.model).getSubSchema(this.prefix);
    let cleanPatch = { ...patch };
    delete cleanPatch._id; // Virtual field
    delete cleanPatch._pid; // Ignore _pids: they should not be editable from the frontend.
    if (Object.keys(cleanPatch).length === 0) return;
    if (schema.isLeaf) cleanPatch = cleanPatch.content;

    // Perform update
    const idsByPath = groupIdsByPath(ids);
    const promises = Object.entries(idsByPath).map(async ([path, rootIds]) =>
      this.model.updateMany({ _id: rootIds }, { [path]: cleanPatch }, { rawResult: true }),
    );

    await Promise.all(promises);
  }

  async delete(caller: Caller, filter: Filter): Promise<void> {
    const records = await this.list(caller, filter, new Projection('_id'));
    const ids = records.map(record => record._id);

    if (!this.prefix) {
      return this.model.deleteMany({ _id: ids }, { rawResult: true }).then(() => {});
    }

    const schema = MongooseSchema.fromModel(this.model).getSubSchema(this.prefix);
    const idsByPath = groupIdsByPath(ids);

    if (schema.isArray) {
      for (const path of Object.keys(idsByPath).sort(compareIds).reverse()) {
        const arrayPath = path.substring(0, path.lastIndexOf('.'));
        const index = Number(path.substring(path.lastIndexOf('.') + 1));

        // There is no update operator to pop items out of arrays at known positions
        // => we use an aggregation pipeline in the update operation
        // @see https://jira.mongodb.org/browse/SERVER-1014?focusedCommentId=2305681#comment-2305681
        const newArrayValue = [
          { $slice: [`$${arrayPath}`, index] },
          { $slice: [`$${arrayPath}`, index + 1, { $size: `$${arrayPath}` }] },
        ];

        // When updating arrays, indexes will change with each request so we need to perform the
        // request sequentially.
        // eslint-disable-next-line no-await-in-loop
        await this.model.collection.updateMany(
          { _id: { $in: idsByPath[path] } },
          [{ $set: { [arrayPath]: { $concatArrays: newArrayValue } } }],
          {},
        );
      }
    } else {
      const promises = Object.entries(idsByPath).map(([path, pathIds]) =>
        this.model.collection.updateMany({ _id: { $in: pathIds } }, { $unset: { [path]: '' } }, {}),
      );

      await Promise.all(promises);
    }
  }

  async aggregate(
    caller: Caller,
    filter: Filter,
    aggregation: Aggregation,
    limit?: number,
  ): Promise<AggregateResult<TSchema, string>[]> {
    const lookupProjection = aggregation.projection.union(filter.conditionTree?.projection);
    const rows = await this.model.aggregate([
      ...this.buildBasePipeline(filter, lookupProjection),
      ...GroupGenerator.group(aggregation),
      { $sort: { value: -1 as const } },
      ...(limit ? [{ $limit: limit }] : []),
    ]);

    return replaceMongoTypes(rows);
  }

  private buildBasePipeline(
    filter: PaginatedFilter,
    lookupProjection: Projection,
  ): PipelineStage[] {
    return [
      ...ReparentGenerator.reparent(this.model, this.prefix),
      ...VirtualFieldsGenerator.addVirtual(
        this.model,
        this.prefix,
        this.ignoreFields,
        lookupProjection,
      ),
      ...LookupGenerator.lookup(this.model, this.prefix, lookupProjection),
      ...FilterGenerator.filter(this.model, this.prefix, filter),
    ];
  }
}
