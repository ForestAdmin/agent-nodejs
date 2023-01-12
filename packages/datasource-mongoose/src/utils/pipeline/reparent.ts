import { Model, PipelineStage } from 'mongoose';

import MongooseSchema from '../../mongoose/schema';

/**
 * Generate pipeline to query submodels.
 *
 * The operations make rotations in the documents so that the root is changed to the submodel
 * without loosing the parent (which may be needed later on).
 */
export default class ReparentGenerator {
  static reparent(
    model: Model<unknown>,
    stack: { prefix: string | null; asFields: string[]; asModels: string[] }[],
  ): PipelineStage[] {
    const schema = MongooseSchema.fromModel(model);

    return stack.flatMap((step, index) => {
      if (index === 0) return this.unflatten(step.asFields);

      const localSchema = schema.getSubSchema(step.prefix);
      const relativePrefix =
        stack[index - 1].prefix !== null
          ? step.prefix.substring(stack[index - 1].prefix.length + 1)
          : step.prefix;

      return [
        ...(localSchema.isArray
          ? this.reparentArray(relativePrefix, localSchema.isLeaf)
          : this.reparentObject(relativePrefix, localSchema.isLeaf)),
        ...this.unflatten(step.asFields),
      ];
    });
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

  static unflatten(asFields: string[]): PipelineStage[] {
    return asFields.length
      ? [
          { $addFields: Object.fromEntries(asFields.map(f => [f.replace(/\./g, '@@@'), `$${f}`])) },
          { $project: Object.fromEntries(asFields.map(f => [f, 0])) },
        ]
      : [];
  }
}
