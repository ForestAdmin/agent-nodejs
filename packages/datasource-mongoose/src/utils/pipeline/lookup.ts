import { Projection } from '@forestadmin/datasource-toolkit';
import { Model, PipelineStage } from 'mongoose';

import MongooseSchema, { SchemaNode } from '../../mongoose/schema';
import { Stack } from '../../types';

/**
 * Transform a forest admin projection into a mongo pipeline that performs the lookups
 * and transformations to target them
 */
export default class LookupGenerator {
  static lookup(model: Model<unknown>, stack: Stack, projection: Projection): PipelineStage[] {
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
    );
  }

  private static lookupProjection(
    models: Record<string, Model<unknown>>,
    currentPath: string,
    schemaStack: SchemaNode[],
    projection: Projection,
  ): PipelineStage[] {
    const pipeline = [];

    for (const [name, subProjection] of Object.entries(projection.relations)) {
      pipeline.push(...this.lookupRelation(models, currentPath, schemaStack, name, subProjection));
    }

    return pipeline;
  }

  private static lookupRelation(
    models: Record<string, Model<unknown>>,
    currentPath: string,
    schemaStack: SchemaNode[],
    name: string,
    subProjection: Projection,
  ): PipelineStage[] {
    const as = currentPath ? `${currentPath}.${name}` : name;

    const lastSchema = schemaStack[schemaStack.length - 1];
    const previousSchemas = schemaStack.slice(0, schemaStack.length - 1);

    // Native many to one relation
    if (name.endsWith('__manyToOne')) {
      const foreignKeyName = name.substring(0, name.length - '__manyToOne'.length);
      const model = models[lastSchema[foreignKeyName].options.ref];

      const from = model.collection.collectionName;
      const localField = currentPath ? `${currentPath}.${foreignKeyName}` : foreignKeyName;
      const foreignField = '_id';

      const subSchema = MongooseSchema.fromModel(model).fields;

      const $addFields = subProjection
        .filter(field => field.includes('@@@'))
        .map(fieldName => `${name}${fieldName}`)
        .reduce(
          (acc: object, curr: string) => ((acc[curr] = `$${curr.replace(/@@@/g, '.')}`), acc),
          {},
        );

      return [
        // Push lookup to pipeline
        { $lookup: { from, localField, foreignField, as } },
        { $unwind: { path: `$${as}`, preserveNullAndEmptyArrays: true } },
        { $addFields },

        // Recurse to get relations of relations
        ...this.lookupProjection(models, as, [...schemaStack, subSchema], subProjection),
      ];
    }

    // Inverse of fake relation
    if (name === 'parent' && previousSchemas.length) {
      return this.lookupProjection(models, as, previousSchemas, subProjection);
    }

    // Fake relation
    if (lastSchema[name]) {
      return this.lookupProjection(models, as, [...schemaStack, lastSchema[name]], subProjection);
    }

    // We should have handled all possible cases.
    throw new Error(`Unexpected relation: '${name}'`);
  }
}
