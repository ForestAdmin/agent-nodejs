import { Model, PipelineStage } from 'mongoose';
import { Projection } from '@forestadmin/datasource-toolkit';
import MongooseSchema, { SchemaNode } from '../../mongoose/schema';

/**
 * Transform a forest admin projection into a mongo pipeline that performs the lookups
 * and transformations to target them
 */
export default class LookupGenerator {
  static lookup(model: Model<unknown>, prefix: string, projection: Projection): PipelineStage[] {
    const childSchema = MongooseSchema.fromModel(model).getSubSchema(prefix, true).fields;

    return this.lookupRec(model.db.models, null, childSchema, projection);
  }

  private static lookupRec(
    models: Record<string, Model<unknown>>,
    currentPath: string,
    schema: SchemaNode,
    projection: Projection,
  ): PipelineStage[] {
    const pipeline = [];

    for (const [name, subProjection] of Object.entries(projection.relations))
      pipeline.push(...this.lookupRelation(models, currentPath, schema, name, subProjection));

    return pipeline;
  }

  private static lookupRelation(
    models: Record<string, Model<unknown>>,
    currentPath: string,
    schema: SchemaNode,
    name: string,
    subProjection: Projection,
  ): PipelineStage[] {
    const as = currentPath ? `${currentPath}.${name}` : name;

    // Native many to one relation
    if (name.endsWith('__manyToOne')) {
      const foreignKeyName = name.substring(0, name.length - '__manyToOne'.length);
      const model = models[schema[foreignKeyName].options.ref];

      const from = model.collection.collectionName;
      const localField = currentPath ? `${currentPath}.${foreignKeyName}` : foreignKeyName;
      const foreignField = '_id';

      const subSchema = MongooseSchema.fromModel(model).fields;

      return [
        // Push lookup to pipeline
        { $lookup: { from, localField, foreignField, as } },
        { $unwind: { path: `$${as}`, preserveNullAndEmptyArrays: true } },

        // Recurse to get relations of relations
        ...this.lookupRec(models, as, subSchema, subProjection),
      ];
    }

    // Fake relation or inverse of fake relation
    if (name === 'parent' || schema[name]) {
      return this.lookupRec(models, as, schema[name], subProjection);
    }

    // We should have handled all possible cases.
    throw new Error(`Unexpected relation: '${name}'`);
  }
}
