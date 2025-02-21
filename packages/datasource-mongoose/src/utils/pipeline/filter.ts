import {
  ConditionTree,
  ConditionTreeBranch,
  ConditionTreeLeaf,
  Operator,
  PaginatedFilter,
} from '@forestadmin/datasource-toolkit';
import { DateTime } from 'luxon';
import { Model, PipelineStage, Types, isValidObjectId } from 'mongoose';

import MongooseSchema from '../../mongoose/schema';
import { Stack } from '../../types';
import VersionManager from '../version-manager';

const STRING_OPERATORS = ['Match', 'NotContains', 'LongerThan', 'ShorterThan'];

/** Transform a forest admin filter into mongo pipeline */
export default class FilterGenerator {
  static sortAndPaginate(model: Model<unknown>, filter: PaginatedFilter): PipelineStage[][] {
    const sort = this.computeSort(filter?.sort);

    const sortAndLimitStages: PipelineStage[] = [];

    if (sort) sortAndLimitStages.push({ $sort: sort });

    if (filter.page?.skip !== undefined) sortAndLimitStages.push({ $skip: filter.page.skip });
    if (filter.page?.limit !== undefined) sortAndLimitStages.push({ $limit: filter.page.limit });

    const allSortCriteriaNative = !Object.keys(sort || {}).find(
      key => !Object.keys(model.schema.paths).includes(key),
    );

    if (allSortCriteriaNative && !filter.conditionTree) {
      // if sort applies to native fields and no filters are applied (very common case)
      // we apply pre-sort + limit at the beginning of the pipeline (to improve perf)
      return [sortAndLimitStages, [], []];
    }

    const allConditionTreeKeysNative = !(filter.conditionTree?.projection || []).find(
      key => !Object.keys(model.schema.paths).includes(key),
    );

    if (allSortCriteriaNative && allConditionTreeKeysNative) {
      // if filters apply to native fields only, we can apply the sort right after filtering
      return [[], sortAndLimitStages, []];
    }

    // if sorting apply to relations, it is safer to do it at the end of the pipeline
    return [[], [], sortAndLimitStages];
  }

  static filter(model: Model<unknown>, stack: Stack, filter: PaginatedFilter): PipelineStage[] {
    const fields = new Set<string>();
    const tree = filter?.conditionTree;
    const match = this.computeMatch(model, stack, tree, fields);

    const pipeline = [];
    if (fields.size) pipeline.push(this.computeFields(fields));
    if (match) pipeline.push({ $match: match });

    return pipeline;
  }

  static listRelationsUsedInFilter(filter: PaginatedFilter): Set<string> {
    const fields = new Set<string>();

    if (filter?.sort) {
      filter.sort.forEach(s => {
        this.listPaths(s.field).forEach(field => fields.add(field));
      });
    }

    this.listFieldsUsedInFilterTree(filter?.conditionTree, fields);

    return fields;
  }

  private static listFieldsUsedInFilterTree(tree: ConditionTree, fields: Set<string>) {
    if (tree instanceof ConditionTreeBranch) {
      tree.conditions.forEach(condition => this.listFieldsUsedInFilterTree(condition, fields));
    } else if (tree instanceof ConditionTreeLeaf && tree.field.includes(':')) {
      this.listPaths(tree.field).forEach(field => fields.add(field));
    }
  }

  private static listPaths(field: string): string[] {
    const parts = field.split(':');
    const parentPaths = parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join('.'));

    return parentPaths;
  }

  private static computeMatch(
    model: Model<unknown>,
    stack: Stack,
    tree: ConditionTree,
    fields: Set<string>,
  ): PipelineStage.Match['$match'] {
    const schema = MongooseSchema.fromModel(model).applyStack(stack, true);

    if (tree instanceof ConditionTreeBranch) {
      return {
        [`$${tree.aggregator.toLowerCase()}`]: tree.conditions.map(condition =>
          this.computeMatch(model, stack, condition, fields),
        ),
      };
    }

    if (tree instanceof ConditionTreeLeaf) {
      const value = this.formatAndCastLeafValue(schema, tree, fields);
      const condition = this.buildMatchCondition(tree.operator, value);

      return { [this.formatNestedFieldPath(tree.field)]: condition };
    }

    return null;
  }

  private static formatAndCastLeafValue(
    schema: MongooseSchema,
    leaf: ConditionTreeLeaf,
    fields: Set<string>,
  ) {
    // @fixme not a big fan of modifying the condition tree here.
    // those objects should be frozen, as the modification will show if the condition tree
    // is used after the request (for instance for "after hooks").

    let { value } = leaf;
    leaf.field = this.formatNestedFieldPath(leaf.field);

    const [isArray, instance] = this.getFieldMetadata(schema, leaf.field);

    // @fixme I'm really not sure that this can work in all cases.
    // It assumes that the type of the value is the same than the type of the column
    // which is not the case for many operators.

    if (isArray) {
      if (
        instance === 'Date' &&
        Array.isArray(value) &&
        value.every(v => DateTime.fromISO(v).isValid)
      ) {
        value = (value as Array<string>).map(v => new Date(v));
      } else if (
        instance === VersionManager.ObjectIdTypeName &&
        Array.isArray(value) &&
        value.every(v => isValidObjectId(v))
      ) {
        value = (value as Array<string>).map(id => new Types.ObjectId(id));
      }
    } else if (instance === VersionManager.ObjectIdTypeName) {
      if (STRING_OPERATORS.includes(leaf.operator)) {
        fields.add(leaf.field);
        leaf.field = this.formatStringFieldName(leaf.field);
      } else if (Array.isArray(value) && value.every(v => isValidObjectId(v))) {
        value = (value as Array<string>).map(id => new Types.ObjectId(id));
      } else if (isValidObjectId(value)) {
        value = new Types.ObjectId(value as string);
      }
    } else if (instance === 'Date') {
      value = new Date(value as string);
    }

    return value;
  }

  private static buildMatchCondition(
    operator: Operator,
    formattedLeafValue: unknown,
  ): PipelineStage.Match['$match'] {
    switch (operator) {
      case 'GreaterThan':
        return { $gt: formattedLeafValue };
      case 'GreaterThanOrEqual':
        return { $gte: formattedLeafValue };
      case 'LessThan':
        return { $lt: formattedLeafValue };
      case 'LessThanOrEqual':
        return { $lte: formattedLeafValue };
      case 'Equal':
        return { $eq: formattedLeafValue };
      case 'NotEqual':
        return { $ne: formattedLeafValue };
      case 'In':
        return { $in: formattedLeafValue };
      case 'IncludesAll':
        return { $all: formattedLeafValue };
      case 'IncludesNone':
        return Array.isArray(formattedLeafValue)
          ? { $nin: formattedLeafValue }
          : { $ne: formattedLeafValue };
      case 'NotContains':
        return { $not: new RegExp(`.*${formattedLeafValue}.*`) };
      case 'NotIContains':
        return { $not: new RegExp(`.*${formattedLeafValue}.*`, 'i') };
      case 'Match':
        return formattedLeafValue;
      case 'Present':
        return { $exists: true, $ne: null };
      default:
        throw new Error(`Unsupported '${operator}' operator`);
    }
  }

  private static computeSort(sorts: PaginatedFilter['sort']): PipelineStage.Sort['$sort'] {
    if (!sorts || sorts.length === 0) return null;

    const result = {};

    for (const { field, ascending } of sorts) {
      const formattedField = this.formatNestedFieldPath(field);
      result[formattedField] = ascending ? 1 : -1;
    }

    return result;
  }

  private static computeFields(fields: Set<string>): PipelineStage.AddFields {
    return Array.from(fields).reduce(
      (computed, field) => {
        const stringField = this.formatStringFieldName(field);
        computed.$addFields[stringField] = { $toString: `$${field}` };

        return computed;
      },
      { $addFields: {} },
    );
  }

  private static formatNestedFieldPath(field: string): string {
    return field.replace(/:/g, '.');
  }

  private static formatStringFieldName(field: string): string {
    const parts = field.split('.');
    parts.push(`string_${parts.pop()}`);

    return parts.join('.');
  }

  private static getFieldMetadata(schema: MongooseSchema, field: string): [boolean, string] {
    // nested _ids are strings
    let isArray: boolean;
    let instance: string;

    try {
      // This may crash when we query virtual one to one relationships, because their virtual
      // fields are not in the schema (This is documented in MongooseSchema)
      const subSchema = schema.getSubSchema(field);
      isArray = subSchema.isArray;
      instance = subSchema.schemaType.instance;
    } catch {
      isArray = false;
      instance = 'String';
    }

    return [isArray, instance];
  }
}
