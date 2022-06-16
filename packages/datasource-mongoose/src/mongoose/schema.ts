/* eslint-disable no-underscore-dangle */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Model, Schema, SchemaType } from 'mongoose';

import { recursiveSet } from '../utils/helpers';

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

  get schemaType(): SchemaType {
    if (this.fields.content instanceof SchemaType) {
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

  getSubSchema(path: string, withParent = false): MongooseSchema {
    // Terminating condition
    if (path === null) return this;

    // General case: go down the tree
    const dotIndex = path.indexOf('.');
    const prefix = dotIndex === -1 ? path : path.substring(0, dotIndex);
    const suffix = dotIndex === -1 ? null : path.substring(dotIndex + 1);
    let isArray = false;
    let isLeaf = false;

    let child = this.fields[prefix] as SchemaBranch;

    // Traverse relations
    if (prefix.endsWith('__manyToOne')) {
      const foreignKeyName = prefix.substring(0, prefix.length - '__manyToOne'.length);
      const relationName = this.fields[foreignKeyName].options.ref;
      child = MongooseSchema.fromModel(this.models[relationName]).fields;
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

    // If we want parent to be included, re-add the rootSchema
    if (withParent && !prefix.endsWith('__manyToOne')) {
      const id = new Schema.Types.String(prefix, {}, 'String');
      child = { ...child, _id: id, _pid: this.fields._id, parent: this.fields };
    }

    return new MongooseSchema(this.models, child, isArray, isLeaf).getSubSchema(suffix, withParent);
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
