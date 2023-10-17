import { Model, PipelineStage } from 'mongoose';

/**
 * Generate pipeline to query submodels.
 *
 * The operations make rotations in the documents so that the root is changed to the submodel
 * without loosing the parent (which may be needed later on).
 */
export default class AsModelNotNullGenerator {
  static asModelNotNull(
    model: Model<unknown>,
    stack: { prefix: string | null; asFields: string[]; asModels: string[] }[],
  ): PipelineStage[] {
    return stack.flatMap(({ prefix, asModels }) => {
      return asModels.map(
        (asModel): PipelineStage => ({
          $match: {
            [[prefix, asModel].filter(Boolean).join('.')]: { $ne: null },
          },
        }),
      );
    });
  }
}
