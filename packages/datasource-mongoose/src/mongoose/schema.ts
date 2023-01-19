/* eslint-disable no-underscore-dangle */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Model, Schema, SchemaType } from 'mongoose';

import { Stack } from '../types';
import { recursiveDelete, recursiveSet } from '../utils/helpers';

export type SchemaBranch = { [key: string]: SchemaNode };
export type SchemaNode = SchemaType | SchemaBranch;

export default class MongooseSchema {
  readonly isArray: boolean;
  readonly isLeaf: boolean;
  readonly fields: SchemaBranch;

  private models: { [name: string]: Model<unknown> };

  static fromModel(model: Model<unknown>): MongooseSchema {
    return new MongooseSchema(model.db.models, this.buildFields(model.schema), false, false);
  }

  get schemaNode(): SchemaNode {
    return this.isLeaf ? this.fields.content : this.fields;
  }

  get schemaType(): SchemaType {
    if (this.isLeaf) {
      return this.fields.content as SchemaType;
    }

    throw new Error(`Schema is not a leaf.`);
  }

  constructor(
    models: Record<string, Model<unknown>>,
    fields: SchemaBranch,
    isArray: boolean,
    isLeaf: boolean,
  ) {
    this.models = models;
    this.fields = fields;
    this.isArray = isArray;
    this.isLeaf = isLeaf;
  }

  listPathsMatching(
    handle: (field: string, schema: MongooseSchema) => boolean,
    prefix?: string,
  ): string[] {
    if (this.isLeaf) return [];

    return Object.keys(this.fields).flatMap(field => {
      const schema = this.getSubSchema(field);
      const subPrefix = `${prefix ? `${prefix}.` : ''}${field}`;
      const subFields = schema
        .listPathsMatching(handle, subPrefix)
        .map(subField => `${field}.${subField}`);

      return handle(subPrefix, schema) ? [field, ...subFields] : subFields;
    });
  }

  /**
   * List leafs and arrays up to a certain level
   * Arrays are never traversed
   */
  listFields(level = Infinity): string[] {
    if (this.isLeaf) throw new Error('Cannot list fields on a leaf schema.');
    if (level === 0) throw new Error('Level must be greater than 0.');
    if (level === 1) return Object.keys(this.fields);

    return Object.keys(this.fields).flatMap(field => {
      const schema = this.getSubSchema(field);
      if (schema.isLeaf || schema.isArray) return [field];

      return schema.listFields(level - 1).map(subField => `${field}.${subField}`);
    });
  }

  applyStack(stack: Stack, skipAsModels = false): MongooseSchema {
    if (stack.length === 0) throw new Error('Stack can never be empty.');

    const step = stack.pop();
    const subSchema = this.getSubSchema(step.prefix);

    for (const field of step.asFields) {
      const fieldSchema = subSchema.getSubSchema(field);
      recursiveDelete(subSchema.fields, field);
      subSchema.fields[field.replace(/\./g, '@@@')] = fieldSchema.isArray
        ? { '[]': fieldSchema.schemaNode }
        : fieldSchema.schemaNode;
    }

    if (stack.length) {
      subSchema.fields._id = new Schema.Types.String('__placeholder__');
      subSchema.fields.parent = this.applyStack(stack).fields;
      subSchema.fields.parentId = subSchema.fields.parent._id;
    }

    if (!skipAsModels) {
      for (const field of step.asModels) {
        recursiveDelete(this.fields, field);
      }
    } else {
      // Here we actually should recurse into the subSchema and add the _id and parentId fields
      // to the virtual one-to-one relations.
      //
      // The issue is that we can't do that because we don't know where the relations are after
      // the first level of nesting (we would need to have the complete asModel / asFields like in
      // the datasource.ts file).
      //
      // Because of that, we need to work around the missing fields in:
      // - pipeline/virtual-fields.ts file: we're throwing an error when we can't guess the value
      //   of a given _id / parentId field.
      // - pipeline/filter.ts: we're using an educated guess for the types of the _id / parentId
      //   fields (String or ObjectId)
    }

    stack.push(step);

    return subSchema;
  }

  getSubSchema(path: string): MongooseSchema {
    // Terminating condition
    if (!path) return this;

    // General case: go down the tree
    const [prefix, suffix] = path.split(/\.(.*)/);
    let isArray = false;
    let isLeaf = false;
    let child = this.fields[prefix] as SchemaBranch;

    // Traverse relations
    if (prefix.endsWith('__manyToOne')) {
      const foreignKeyName = prefix.substring(0, prefix.length - '__manyToOne'.length);
      const relationName = this.fields[foreignKeyName].options.ref;

      // FIXME We should definitively apply the foreign collection stack here
      child = MongooseSchema.fromModel(this.models[relationName]).fields;
    } else if (!child) {
      throw new Error(`Field '${prefix}' not found. Available fields are: ${this.listFields()}`);
    }

    // Traverse arrays
    if (child['[]']) {
      child = child['[]'] as SchemaBranch;
      isArray = true;
    }

    // We ended up on a field => box it.
    if (child instanceof SchemaType) {
      child = { content: child };
      isLeaf = true;
    }

    return new MongooseSchema(this.models, child, isArray, isLeaf).getSubSchema(suffix);
  }

  /**
   * Build a tree of SchemaType from a mongoose schema.
   * This removes most complexity from using prefixes, nested schemas and array types
   */
  private static buildFields(schema: Schema, level = 0): SchemaBranch {
    const paths = {};

    for (const [name, field] of Object.entries(schema.paths)) {
      // Exclude mixedFieldPattern $* and privateFieldPattern __
      if (!name.startsWith('$*') && !name.includes('__') && (name !== '_id' || level === 0)) {
        // Flatten nested schemas and arrays
        if (field.constructor.name === 'SubdocumentPath') {
          const subPaths = this.buildFields(field.schema as Schema, level + 1);
          for (const [subName, subField] of Object.entries(subPaths))
            recursiveSet(paths, `${name}.${subName}`, subField);
        } else if (field.constructor.name === 'DocumentArrayPath') {
          const subPaths = this.buildFields(field.schema as Schema, level + 1);
          for (const [subName, subField] of Object.entries(subPaths))
            recursiveSet(paths, `${name}.[].${subName}`, subField);
        } else if (field.constructor.name === 'SchemaArray') {
          recursiveSet(paths, `${name}.[]`, (field as any).caster);
        } else {
          recursiveSet(paths, name, field);
        }
      }
    }

    return paths;
  }
}
