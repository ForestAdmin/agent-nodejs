import { Model, PipelineStage, SchemaType } from 'mongoose';

import MongooseSchema, { SchemaNode } from '../../mongoose/schema';

/**
 * Generate pipeline to query submodels.
 *
 * The operations make rotations in the documents so that the root is changed to the submodel
 * without loosing the parent (which may be needed later on).
 */
export default class ReparentGenerator {
  static reparent(model: Model<unknown>, prefix: string | null): PipelineStage[] {
    if (!prefix?.length) return [];

    // Take only the part of the records we are interested in
    const pipeline = [];
    let schema: SchemaNode = MongooseSchema.fromModel(model).fields;

    for (const part of prefix.split('.')) {
      pipeline.push(
        ...(schema[part]['[]']
          ? this.reparentArray(part, schema[part]['[]'] instanceof SchemaType)
          : this.reparentObject(part, schema[part] instanceof SchemaType)),
      );

      schema = schema[part];
      if (schema['[]']) schema = schema['[]'];
    }

    // If we end up on a field, create a virtual record
    return pipeline;
  }

  private static reparentArray(prefix: string, inDoc: boolean): PipelineStage[] {
    return [
      { $unwind: { path: `$${prefix}`, includeArrayIndex: 'index' } },
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              inDoc ? { content: `$${prefix}` } : `$${prefix}`,
              {
                _id: { $concat: [{ $toString: '$_id' }, `.${prefix}.`, { $toString: '$index' }] },
                parentId: '$_id',
                parent: '$$ROOT',
              },
            ],
          },
        },
      },
    ];
  }

  private static reparentObject(prefix: string, inDoc: boolean): PipelineStage[] {
    return [
      {
        $replaceRoot: {
          newRoot: {
            $mergeObjects: [
              inDoc ? { content: `$${prefix}` } : `$${prefix}`,
              {
                _id: { $concat: [{ $toString: '$_id' }, `.${prefix}`] },
                parentId: '$_id',
                parent: '$$ROOT',
              },
            ],
          },
        },
      },
    ];
  }
}
