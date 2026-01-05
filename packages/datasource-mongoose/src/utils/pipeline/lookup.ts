import type { SchemaNode } from '../../mongoose/schema';
import type { Stack } from '../../types';
import type { Projection } from '@forestadmin/datasource-toolkit';
import type { Model, PipelineStage } from 'mongoose';

import MongooseSchema from '../../mongoose/schema';

export type LookupOptions = {
  include?: Set<string>;
  exclude?: Set<string>;
};

/**
 * Transform a forest admin projection into a mongo pipeline that performs the lookups
 * and transformations to target them
 */
export default class LookupGenerator {
  static lookup(
    model: Model<unknown>,
    stack: Stack,
    projection: Projection,
    options: LookupOptions,
  ): PipelineStage[] {
    const schemaStack = stack.reduce(
      (acc, _, index) => {
        return [
          ...acc,
          MongooseSchema.fromModel(model).applyStack(stack.slice(0, index + 1), true),
        ];
      },
      [MongooseSchema.fromModel(model)],
    );

    return this.lookupProjection(
      model.db.models,
      null,
      schemaStack.map(s => s.fields),
      projection,
      options,
    );
  }

  private static lookupProjection(
    models: Record<string, Model<unknown>>,
    currentPath: string,
    schemaStack: SchemaNode[],
    projection: Projection,
    options: LookupOptions,
  ): PipelineStage[] {
    const pipeline = [];
    const $addFields = {};

    for (const [name, subProjection] of Object.entries(projection.relations)) {
      pipeline.push(
        ...this.lookupRelation(models, currentPath, schemaStack, name, subProjection, options),
      );
      Object.assign($addFields, this.addFields(name, subProjection, options));
    }

    if (Object.keys($addFields).length) pipeline.push({ $addFields });

    return pipeline;
  }

  /**
   * $addFields aliases are needed in the case of relations with nested fields
   */
  private static addFields(
    name: string,
    subProjection: Projection,
    options: LookupOptions,
  ): Record<string, string> {
    if (options.include && !options.include.has(name)) return {};
    if (options.exclude?.has(name)) return {};

    return subProjection
      .filter(field => field.includes('@@@'))
      .map(fieldName => `${name}.${fieldName.replace(/:/, '.')}`)
      .reduce((acc: object, curr: string) => {
        acc[curr] = `$${curr.replace(/@@@/g, '.')}`;

        return acc;
      }, {});
  }

  private static lookupRelation(
    models: Record<string, Model<unknown>>,
    currentPath: string,
    schemaStack: SchemaNode[],
    name: string,
    subProjection: Projection,
    options: LookupOptions,
  ): PipelineStage[] {
    const as = currentPath ? `${currentPath}.${name}` : name;

    const lastSchema = schemaStack[schemaStack.length - 1];
    const previousSchemas = schemaStack.slice(0, schemaStack.length - 1);

    if (options.exclude?.has(as)) return [];
    if (options.include && !options.include.has(as)) return [];

    // Native many to one relation
    if (name.endsWith('__manyToOne')) {
      const foreignKeyName = name.substring(0, name.length - '__manyToOne'.length);
      const model = models[lastSchema[foreignKeyName].options.ref];

      const from = model.collection.collectionName;
      const localField = currentPath ? `${currentPath}.${foreignKeyName}` : foreignKeyName;
      const foreignField = '_id';

      const subSchema = MongooseSchema.fromModel(model).fields;

      return [
        // Push lookup to pipeline
        { $lookup: { from, localField, foreignField, as } },
        { $unwind: { path: `$${as}`, preserveNullAndEmptyArrays: true } },

        // Recurse to get relations of relations
        ...this.lookupProjection(models, as, [...schemaStack, subSchema], subProjection, options),
      ];
    }

    // Inverse of fake relation
    if (name === 'parent' && previousSchemas.length) {
      return this.lookupProjection(models, as, previousSchemas, subProjection, options);
    }

    // Fake relation
    if (lastSchema[name]) {
      return this.lookupProjection(
        models,
        as,
        [...schemaStack, lastSchema[name]],
        subProjection,
        options,
      );
    }

    // We should have handled all possible cases.
    throw new Error(`Unexpected relation: '${name}'`);
  }
}
