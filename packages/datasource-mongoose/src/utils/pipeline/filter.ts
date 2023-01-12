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

const STRING_OPERATORS = ['Like', 'ILike', 'NotContains', 'LongerThan', 'ShorterThan'];

/** Transform a forest admin filter into mongo pipeline */
export default class FilterGenerator {
  static filter(model: Model<unknown>, stack: Stack, filter: PaginatedFilter): PipelineStage[] {
    const fields = new Set<string>();
    const tree = filter?.conditionTree;
    const match = this.computeMatch(model, stack, tree, fields);
    const sort = this.computeSort(filter?.sort);

    const pipeline = [];
    if (fields.size) pipeline.push(this.computeFields(fields));
    if (match) pipeline.push({ $match: match });
    if (sort) pipeline.push({ $sort: sort });
    if (filter?.page?.skip !== undefined) pipeline.push({ $skip: filter.page.skip });
    if (filter?.page?.limit !== undefined) pipeline.push({ $limit: filter.page.limit });

    return pipeline;
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
        instance === 'ObjectID' &&
        Array.isArray(value) &&
        value.every(v => isValidObjectId(v))
      ) {
        value = (value as Array<string>).map(id => new Types.ObjectId(id));
      }
    } else if (instance === 'ObjectID') {
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
      case 'LessThan':
        return { $lt: formattedLeafValue };
      case 'Equal':
        return { $eq: formattedLeafValue };
      case 'NotEqual':
        return { $ne: formattedLeafValue };
      case 'In':
        return { $in: formattedLeafValue };
      case 'IncludesAll':
        return { $all: formattedLeafValue };
      case 'NotContains':
        return { $not: new RegExp(`.*${formattedLeafValue}.*`) };
      case 'Like':
        return this.like(formattedLeafValue as string, true);
      case 'ILike':
        return this.like(formattedLeafValue as string, false);
      case 'Present':
        return { $exists: true, $ne: null };
      default:
        throw new Error(`Unsupported '${operator}' operator`);
    }
  }

  /** @see https://stackoverflow.com/a/18418386/1897495 */
  private static like(pattern: string, caseSensitive: boolean): RegExp {
    let regexp = pattern;

    // eslint-disable-next-line no-useless-escape
    regexp = regexp.replace(/([\.\\\+\*\?\[\^\]\$\(\)\{\}\=\!\<\>\|\:\-])/g, '\\$1');
    regexp = regexp.replace(/%/g, '.*').replace(/_/g, '.');

    return RegExp(`^${regexp}$`, caseSensitive ? 'g' : 'gi');
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
