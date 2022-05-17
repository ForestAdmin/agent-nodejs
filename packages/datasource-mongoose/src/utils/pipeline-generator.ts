import {
  Aggregation,
  AggregationOperation,
  Collection,
  CollectionSchema,
  ConditionTree,
  ConditionTreeBranch,
  ConditionTreeLeaf,
  DateOperation,
  ManyToOneSchema,
  Operator,
  PaginatedFilter,
  Projection,
} from '@forestadmin/datasource-toolkit';
import { Model, PipelineStage, SchemaType, Types, isValidObjectId } from 'mongoose';

const STRING_OPERATORS = [
  'Like',
  'Contains',
  'NotContains',
  'EndsWith',
  'LongerThan',
  'ShorterThan',
];

const AGGREGATION_OPERATION: Record<AggregationOperation, string> = {
  Sum: '$sum',
  Avg: '$avg',
  Count: '$sum',
  Max: '$max',
  Min: '$min',
};
const GROUP_OPERATION: Record<DateOperation, string> = {
  Year: '$year',
  Month: '$month',
  Day: '$dayOfMonth',
  Week: '$week',
};

export default class PipelineGenerator {
  static groups(aggregation: Aggregation) {
    const groups = [];

    if (aggregation.groups) {
      aggregation.groups.forEach(group => {
        const computedGroup = {
          $group: {
            value: undefined,
            _id: undefined,
          },
        };

        if (group.operation) {
          // eslint-disable-next-line no-underscore-dangle
          computedGroup.$group._id = {
            [GROUP_OPERATION[group.operation]]: this.formatNestedFieldPath(`$${group.field}`),
          };
        } else {
          // eslint-disable-next-line no-underscore-dangle
          computedGroup.$group._id = this.formatNestedFieldPath(`$${group.field}`);
        }

        let value: unknown = this.formatNestedFieldPath(`$${aggregation.field}`);
        if (aggregation.operation === 'Count') value = { $cond: [{ $ne: [value, null] }, 1, 0] };

        computedGroup.$group.value = {
          [AGGREGATION_OPERATION[aggregation.operation]]: value,
        };

        groups.push(computedGroup);
      });
    } else {
      let condition: unknown = this.formatNestedFieldPath(`$${aggregation.field}`);

      if (aggregation.operation === 'Count') {
        condition = { $cond: [{ $ne: [condition, null] }, 1, 0] };
      }

      groups.push({
        $group: { _id: null, value: { [AGGREGATION_OPERATION[aggregation.operation]]: condition } },
      });
    }

    return groups;
  }

  static find(
    collection: Collection,
    model: Model<unknown>,
    filter: PaginatedFilter,
    projection: Projection,
  ): PipelineStage[] {
    const { schema } = collection;
    const joints = new Set<string>();
    const fields = new Set<string>();

    const tree = filter?.conditionTree;
    const match = PipelineGenerator.computeMatch(schema, model, tree, joints, fields);
    const sort = PipelineGenerator.computeSort(schema, filter?.sort, joints);
    const project = PipelineGenerator.computeProject(schema, model, projection, joints, fields);

    const pipeline: PipelineStage[] = [];

    pipeline.push(...PipelineGenerator.computeLookups(collection, model, joints));
    if (fields.size) pipeline.push(PipelineGenerator.computeFields(fields));
    if (match) pipeline.push({ $match: match });
    if (sort) pipeline.push({ $sort: sort });
    if (filter?.page?.skip !== undefined) pipeline.push({ $skip: filter.page.skip });
    if (filter?.page?.limit !== undefined) pipeline.push({ $limit: filter.page.limit });
    pipeline.push({ $project: project });

    return pipeline;
  }

  private static computeMatch(
    schema: CollectionSchema,
    model: Model<unknown>,
    conditionTree: ConditionTree,
    joints: Set<string>,
    fields: Set<string>,
  ): PipelineStage.Match['$match'] {
    if (!conditionTree) {
      return null;
    }

    if ((conditionTree as ConditionTreeBranch).aggregator) {
      const tree = conditionTree as ConditionTreeBranch;

      return PipelineGenerator.computeMatchBranch(schema, model, tree, joints, fields);
    }

    const tree = conditionTree as ConditionTreeLeaf;

    return PipelineGenerator.computeMatchLeaf(schema, model, tree, joints, fields);
  }

  private static computeMatchBranch(
    schema: CollectionSchema,
    model: Model<unknown>,
    branch: ConditionTreeBranch,
    joints: Set<string>,
    fields: Set<string>,
  ): PipelineStage.Match['$match'] {
    const subMatch = branch.conditions.map(condition =>
      PipelineGenerator.computeMatch(schema, model, condition, joints, fields),
    );

    if (branch.aggregator === 'And') {
      return { $and: subMatch };
    }

    if (branch.aggregator === 'Or') {
      return { $or: subMatch };
    }

    throw new Error(`Invalid '${branch.aggregator}' aggregator`);
  }

  private static computeMatchLeaf(
    schema: CollectionSchema,
    model: Model<unknown>,
    leaf: ConditionTreeLeaf,
    joints: Set<string>,
    fields: Set<string>,
  ): PipelineStage.Match['$match'] {
    const value = this.formatAndCastLeafValue(leaf, model, fields, schema, joints);
    const condition = this.buildMatchCondition(leaf.operator, value);

    return { [this.formatNestedFieldPath(leaf.field)]: condition };
  }

  private static formatAndCastLeafValue(
    leaf: ConditionTreeLeaf,
    model: Model<unknown>,
    fields: Set<string>,
    schema: CollectionSchema,
    joints: Set<string>,
  ) {
    let { value } = leaf;
    leaf.field = this.formatNestedFieldPath(leaf.field);

    if (this.isRelationField(leaf.field, schema)) {
      this.addJoints(joints, leaf.field);
    }

    const schemaType = this.getSchemaType(model, leaf, schema);
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignorex
    const subType = schemaType?.caster?.instance;
    const instanceType = schemaType?.instance;

    if (instanceType === 'ObjectID') {
      if (STRING_OPERATORS.includes(leaf.operator)) {
        fields.add(leaf.field);
        leaf.field = this.formatStringFieldName(leaf.field);
      } else if (Array.isArray(value) && value.every(v => isValidObjectId(v))) {
        value = (value as Array<string>).map(id => new Types.ObjectId(id));
      } else if (isValidObjectId(value)) {
        value = new Types.ObjectId(value as string);
      }
    } else if (instanceType === 'Date') {
      value = new Date(value as string);
    } else if (instanceType === 'Array') {
      if (subType === 'Date') {
        value = (value as Array<string>).map(v => new Date(v));
      } else if (subType === 'ObjectID') {
        value = (value as Array<string>).map(id => new Types.ObjectId(id));
      }
    }

    return value;
  }

  private static getSchemaType(
    model: Model<unknown>,
    leaf: ConditionTreeLeaf,
    collectionSchema: CollectionSchema,
  ): SchemaType {
    let { schema } = model;
    let { field } = leaf;

    if (this.isRelationField(field, collectionSchema)) {
      field = this.getFieldName(leaf.field);
      const refField = this.getParentPath(leaf.field).replace('_manyToOne', '');
      const referenceName = model.schema.paths[refField].options.ref;
      schema = this.getMongooseModel(model, referenceName).schema;
    }

    return schema.paths[field];
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
      case 'Contains':
        return new RegExp(`.*${formattedLeafValue}.*`);
      case 'NotContains':
        return { $not: new RegExp(`.*${formattedLeafValue}.*`) };
      case 'Like':
        return this.like(formattedLeafValue as string);
      case 'Present':
        return { $exists: true, $ne: null };
      default:
        throw new Error(`Unsupported '${operator}' operator`);
    }
  }

  /** @see https://stackoverflow.com/a/18418386/1897495 */
  private static like(pattern: string): RegExp {
    let regexp = pattern;

    // eslint-disable-next-line no-useless-escape
    regexp = regexp.replace(/([\.\\\+\*\?\[\^\]\$\(\)\{\}\=\!\<\>\|\:\-])/g, '\\$1');
    regexp = regexp.replace(/%/g, '.*').replace(/_/g, '.');

    return RegExp(`^${regexp}$`, 'gi');
  }

  private static computeDefaultProject(
    model: Model<unknown>,
    schema: CollectionSchema,
    joints: Set<string>,
    fields: Set<string>,
  ): Record<string, unknown> {
    const project = { __v: false };

    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    Object.keys(model.schema.singleNestedPaths).forEach(field => {
      if (field.includes('_id')) {
        project[field] = false;
      }
    });

    // adds jointures
    Object.keys(schema.fields).forEach(fieldName => {
      if (this.isRelationField(fieldName, schema)) {
        this.addJoints(joints, fieldName);
      }
    });

    // removes the "computed fields"
    Array.from(fields).forEach(field => {
      project[PipelineGenerator.formatStringFieldName(field)] = false;
    });

    return project;
  }

  private static computeProject(
    schema: CollectionSchema,
    model: Model<unknown>,
    projection: Projection,
    joints: Set<string>,
    fields: Set<string>,
  ): PipelineStage.Project['$project'] {
    if (projection && projection.length === 0) {
      return PipelineGenerator.computeDefaultProject(model, schema, joints, fields);
    }

    const project: PipelineStage.Project['$project'] = { _id: false };

    for (const field of projection) {
      const formattedField = this.formatNestedFieldPath(field);

      if (this.isRelationField(formattedField, schema)) {
        this.addJoints(joints, formattedField);
      }

      project[formattedField] = true;
    }

    return project;
  }

  private static computeSort(
    schema: CollectionSchema,
    sorts: PaginatedFilter['sort'],
    joints: Set<string>,
  ): PipelineStage.Sort['$sort'] {
    if (!sorts || sorts.length === 0) return null;

    const result = {};

    for (const { field, ascending } of sorts) {
      const formattedField = this.formatNestedFieldPath(field);

      if (this.isRelationField(formattedField, schema)) {
        this.addJoints(joints, formattedField);
      }

      result[formattedField] = ascending ? 1 : -1;
    }

    return result;
  }

  private static computeLookups(
    collection: Collection,
    model: Model<unknown>,
    joints: Set<string>,
  ): (PipelineStage.Lookup | PipelineStage.Unwind)[] {
    const lookups = [];

    Array.from(joints).forEach(path => {
      let currentCollection = collection;
      let currentPath;

      path.split('.').forEach(relationName => {
        if (currentPath) {
          currentPath = `${currentPath}.${relationName}`;
        } else {
          currentPath = relationName;
        }

        const relation = currentCollection.schema.fields[relationName] as ManyToOneSchema;
        currentCollection = currentCollection.dataSource.getCollection(relation.foreignCollection);

        const from = this.getMongooseModel(model, relation.foreignCollection).collection
          .collectionName;
        const parentPath = this.getParentPath(currentPath);
        let localField = relation.foreignKey;
        if (parentPath !== currentPath) localField = `${parentPath}.${relation.foreignKey}`;

        lookups.push({
          $lookup: {
            from,
            localField,
            foreignField: relation.foreignKeyTarget,
            as: currentPath,
          },
        });
        lookups.push({ $unwind: { path: `$${currentPath}`, preserveNullAndEmptyArrays: true } });
        lookups.push({ $project: { [`${currentPath}.__v`]: false } });
      });
    });

    return lookups;
  }

  private static getMongooseModel(model: Model<unknown>, modelName: string): Model<unknown> {
    return model.db.models[modelName];
  }

  private static computeFields(fields: Set<string>): PipelineStage.AddFields {
    return Array.from(fields).reduce(
      (computed, field) => {
        const stringField = PipelineGenerator.formatStringFieldName(field);
        computed.$addFields[stringField] = { $toString: `$${field}` };

        return computed;
      },
      { $addFields: {} },
    );
  }

  private static addJoints(joints: Set<string>, field): void {
    const paths = this.getParentPath(this.formatNestedFieldPath(field));
    let isJointAlreadyExists = false;
    Array.from(joints).forEach(joint => {
      if (joint.startsWith(paths)) {
        isJointAlreadyExists = true;
      } else if (paths.startsWith(joint)) {
        joints.delete(joint);
      }
    });
    if (!isJointAlreadyExists) joints.add(paths);
  }

  private static formatNestedFieldPath(field: string): string {
    return field.replace(':', '.');
  }

  private static isRelationField(field: string, schema: CollectionSchema): boolean {
    const relation = this.getParentPath(field).split('.').shift();

    return schema.fields[relation]?.type === 'ManyToOne';
  }

  private static formatStringFieldName(field: string): string {
    const parentPath = this.getParentPath(field);
    const fieldName = this.getFieldName(field);

    if (parentPath === field) {
      return `string_${fieldName}`;
    }

    return `${parentPath}.string_${fieldName}`;
  }

  private static getParentPath(path: string): string {
    if (!path.includes('.')) {
      return path;
    }

    return path.split('.').slice(0, -1).join('.');
  }

  private static getFieldName(path: string): string {
    if (!path.includes('.')) {
      return path;
    }

    return path.split('.').slice(-1).join('.');
  }
}
