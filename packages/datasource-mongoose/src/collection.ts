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
  ValidationError,
} from '@forestadmin/datasource-toolkit';
import { Model, PipelineStage } from 'mongoose';

import MongooseSchema from './mongoose/schema';
import {
  buildSubdocumentPatch,
  compareIds,
  escape,
  groupIdsByPath,
  replaceMongoTypes,
  splitId,
} from './utils/helpers';
import FilterGenerator from './utils/pipeline/filter';
import GroupGenerator from './utils/pipeline/group';
import LookupGenerator from './utils/pipeline/lookup';
import ProjectionGenerator from './utils/pipeline/projection';
import ReparentGenerator from './utils/pipeline/reparent';
import VirtualFieldsGenerator from './utils/pipeline/virtual-fields';
import FieldsGenerator from './utils/schema/fields';

export default class MongooseCollection extends BaseCollection {
  model: Model<RecordData>;
  prefix: string;
  ignoredFields: string[];

  constructor(
    dataSource: DataSource,
    model: Model<RecordData>,
    prefix: string = null,
    ignoredFields: string[] = [],
  ) {
    super(prefix ? escape(`${model.modelName}.${prefix}`) : model.modelName, dataSource);
    this.model = model;
    this.prefix = prefix;
    this.ignoredFields = ignoredFields;

    this.enableCount();
    this.addFields(FieldsGenerator.buildFieldsSchema(model, prefix, ignoredFields));
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
    // Fetch the ids of the documents OR subdocuments that will be updated.
    // We need to do that regardless of `this.prefix` because the filter may contain conditions on
    // relationships.
    const records = await this.list(caller, filter, new Projection('_id'));
    const ids = records.map(record => record._id);

    if (!this.prefix) {
      // We are updating a real document, we can delegate the work to mongoose directly.
      if (ids.length > 1) {
        await this.model.updateMany({ _id: ids }, patch, { rawResult: true });
      } else {
        await this.model.updateOne({ _id: ids }, patch, { rawResult: true });
      }
    } else {
      // We are updating a subdocument (this.prefix is set).

      // This method can be called from customer code, so we need to handle the case where we are
      // updating many documents at once (the GUI only allows to update documents one by one).
      // This is trivial when using the flattener on simple objects, but becomes more convoluted
      // when using arrays: we need to update the right element of the array in each document.
      // For performance reasons we group the ids by path (which contain the indexes of the
      // potentially nested arrays) instead of performing one update per doc.

      // Also note, that when we are using a single field as a model, an extra level of nesting is
      // added (this is common when using the flattener to create many to many relationships)
      const { isLeaf } = MongooseSchema.fromModel(this.model).getSubSchema(this.prefix);

      // `idsByPath` contains one entry if using the flattener in object-mode, but potentially many
      // if using the flattener in array-mode.
      const idsByPath = groupIdsByPath(ids);

      // Perform the updates.
      const promises = Object.entries(idsByPath).map(async ([path, rootIds]) => {
        // When using object-mode flattener, path == this.prefix.
        // When using array-mode flattener, path == this.prefix + '.0' (or '.1', etc).
        // (Both can be used at the same time as this is a recursive process).
        const subdocPatch = buildSubdocumentPatch(path, patch, isLeaf);

        if (Object.keys(subdocPatch).length) {
          await this.model.updateMany({ _id: rootIds }, subdocPatch, { rawResult: true });
        }
      });

      await Promise.all(promises);
    }
  }

  async delete(caller: Caller, filter: Filter): Promise<void> {
    const records = await this.list(caller, filter, new Projection('_id'));
    const ids = records.map(record => record._id);

    if (!this.prefix) {
      await this.model.deleteMany({ _id: ids }, { rawResult: true });

      return;
    }

    const schema = MongooseSchema.fromModel(this.model).getSubSchema(this.prefix);
    const idsByPath = groupIdsByPath(ids);

    if (schema.isArray) {
      // Iterate paths in reverse order so that when we delete elements from arrays, the indexes
      // of the next elements that we'll touch don't change.
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
  ): Promise<AggregateResult[]> {
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
        this.ignoredFields,
        lookupProjection,
      ),
      ...LookupGenerator.lookup(this.model, this.prefix, lookupProjection),
      ...FilterGenerator.filter(this.model, this.prefix, filter),
    ];
  }
}
