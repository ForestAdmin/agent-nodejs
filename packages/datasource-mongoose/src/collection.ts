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
import { Error, Model, PipelineStage, Types } from 'mongoose';

import MongooseSchema from './mongoose/schema';
import { Stack } from './types';
import {
  buildSubdocumentPatch,
  compareIds,
  escape,
  groupIdsByPath,
  replaceMongoTypes,
  splitId,
  unflattenRecord,
} from './utils/helpers';
import FilterGenerator from './utils/pipeline/filter';
import GroupGenerator from './utils/pipeline/group';
import LookupGenerator from './utils/pipeline/lookup';
import ProjectionGenerator from './utils/pipeline/projection';
import ReparentGenerator from './utils/pipeline/reparent';
import VirtualFieldsGenerator from './utils/pipeline/virtual-fields';
import FieldsGenerator from './utils/schema/fields';

export default class MongooseCollection extends BaseCollection {
  model: Model<unknown>;
  stack: Stack;

  constructor(dataSource: DataSource, model: Model<unknown>, stack: Stack) {
    const { prefix } = stack[stack.length - 1];
    const name = prefix ? escape(`${model.modelName}.${prefix}`) : model.modelName;

    super(name, dataSource);
    this.model = model;
    this.stack = stack;

    this.enableCount();
    this.addFields(FieldsGenerator.buildFieldsSchema(model, stack));
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

  async create(caller: Caller, data: RecordData[]): Promise<RecordData[]> {
    return this.handleValidationError(() => this._create(caller, data));
  }

  async update(caller: Caller, filter: Filter, patch: RecordData): Promise<void> {
    return this.handleValidationError(() => this._update(caller, filter, patch));
  }

  async delete(caller: Caller, filter: Filter): Promise<void> {
    return this.handleValidationError(() => this._delete(caller, filter));
  }

  private async _create(caller: Caller, flatData: RecordData[]): Promise<RecordData[]> {
    const { asFields } = this.stack[this.stack.length - 1];
    const data = flatData.map(fd => unflattenRecord(fd, asFields));

    // For root models, we can simply insert the records.
    if (this.stack.length < 2) {
      const { insertedIds } = await this.model.insertMany(data, { rawResult: true });

      return flatData.map((record, index) => ({
        _id: replaceMongoTypes(insertedIds[index]),
        ...record,
      }));
    }

    // Only array fields can create subdocuments (the others should use update)
    const schema = MongooseSchema.fromModel(this.model).applyStack(this.stack);
    if (!schema.isArray)
      throw new ValidationError('Trying to create subrecords on a non-array field');

    // Transform list of subrecords to a list of modifications that we'll apply to the root record.
    const lastStackStep = this.stack[this.stack.length - 1];
    const fieldName =
      this.stack.length > 2
        ? lastStackStep.prefix.substring(this.stack[this.stack.length - 2].prefix.length + 1)
        : lastStackStep.prefix;

    const updates: Record<string, { rootId: unknown; path: string; records: unknown[] }> = {};
    const results = [];

    for (const record of data) {
      const { parentId, ...rest } = record;
      if (!parentId) throw new ValidationError('Trying to create a subrecord with no parent');

      const [rootId, path] = splitId(`${parentId}.${fieldName}`);
      const rootIdString = String(rootId);
      if (!updates[rootIdString]) updates[rootIdString] = { rootId, path, records: [] };

      // unwrap 'content' on leafs
      updates[rootIdString].records.push(schema.isLeaf ? rest.content : rest);

      results.push({
        _id: `${rootId}.${path}.${updates[rootIdString].records.length - 1}`,
        ...record,
      });
    }

    // Apply the modifications to the root document.
    const promises = Object.values(updates).map(({ rootId, path, records }) =>
      this.model.updateOne(
        { _id: rootId },
        { $push: { [path]: { $position: 0, $each: records } } },
      ),
    );

    await Promise.all(promises);

    return results;
  }

  private async _update(caller: Caller, filter: Filter, flatPatch: RecordData): Promise<void> {
    const { asFields } = this.stack[this.stack.length - 1];
    const patch = unflattenRecord(flatPatch, asFields, true);

    // Fetch the ids of the documents OR subdocuments that will be updated.
    // We need to do that regardless of `this.prefix` because the filter may contain conditions on
    // relationships.
    const records = await this.list(caller, filter, new Projection('_id'));
    const ids = records.map(record => record._id);

    if (this.stack.length < 2) {
      // We are updating a real document, we can delegate the work to mongoose directly.
      await (ids.length > 1
        ? this.model.updateMany({ _id: ids }, patch, { rawResult: true })
        : this.model.updateOne({ _id: ids }, patch, { rawResult: true }));
    } else if (patch.parentId && ids.some(id => !id.startsWith(patch.parentId))) {
      // When we update subdocuments, we need to make sure that the new parent is the same as the
      // old one: reparenting is not supported.
      throw new ValidationError(`'${this.name}' is virtual: records cannot be reparented.`);
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
      const { isLeaf } = MongooseSchema.fromModel(this.model).applyStack(this.stack);

      // `idsByPath` contains one entry if using the flattener in object-mode, but potentially many
      // if using the flattener in array-mode.
      const idsByPath = groupIdsByPath(ids);

      // Perform the updates.
      const promises = Object.entries(idsByPath).map(([path, rootIds]) => {
        // When using object-mode flattener, path == this.prefix.
        // When using array-mode flattener, path == this.prefix + '.0' (or '.1', etc).
        // (Both can be used at the same time as this is a recursive process).
        const subdocPatch = buildSubdocumentPatch(path, patch, isLeaf);
        if (!Object.keys(subdocPatch).length) return null;

        return ids.length > 1
          ? this.model.updateMany({ _id: rootIds }, subdocPatch, { rawResult: true })
          : this.model.updateOne({ _id: rootIds }, subdocPatch, { rawResult: true });
      });

      await Promise.all(promises);
    }
  }

  private async _delete(caller: Caller, filter: Filter): Promise<void> {
    const records = await this.list(caller, filter, new Projection('_id'));
    const ids = records.map(record => record._id);

    if (this.stack.length < 2) {
      await this.model.deleteMany({ _id: ids }, { rawResult: true });

      return;
    }

    const schema = MongooseSchema.fromModel(this.model).applyStack(this.stack);
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
          {
            _id: {
              $in: idsByPath[path].map((id: string) => new Types.ObjectId(id)),
            },
          },
          [{ $set: { [arrayPath]: { $concatArrays: newArrayValue } } }],
          {},
        );
      }
    } else {
      const promises = Object.entries(idsByPath).map(([path, pathIds]) =>
        this.model.collection.updateMany(
          {
            _id: { $in: pathIds.map((id: string) => new Types.ObjectId(id)) },
          },
          { $unset: { [path]: '' } },
          {},
        ),
      );

      await Promise.all(promises);
    }
  }

  private buildBasePipeline(
    filter: PaginatedFilter,
    lookupProjection: Projection,
  ): PipelineStage[] {
    return [
      ...ReparentGenerator.reparent(this.model, this.stack),
      ...VirtualFieldsGenerator.addVirtual(this.model, this.stack, lookupProjection),
      ...LookupGenerator.lookup(this.model, this.stack, lookupProjection),
      ...FilterGenerator.filter(this.model, this.stack, filter),
    ];
  }

  private async handleValidationError<T>(callback: () => Promise<T>): Promise<T> {
    try {
      // Do not remove the await here, it's important!
      return await callback();
    } catch (error) {
      if (error instanceof Error.ValidationError) {
        throw new ValidationError(error.message);
      }

      throw error;
    }
  }
}
