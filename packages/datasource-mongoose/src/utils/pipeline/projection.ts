import { Projection } from '@forestadmin/datasource-toolkit';
import { PipelineStage } from 'mongoose';

/** Generate a mongo pipeline which applies a forest admin projection */
export default class ProjectionGenerator {
  static project(projection: Projection): PipelineStage[] {
    if (projection.length === 0) {
      return [{ $replaceRoot: { newRoot: { $literal: {} } } }];
    }

    const project: PipelineStage.Project['$project'] = { _id: false };

    for (const field of projection) {
      const formattedField = field.replace(/:/g, '.');
      project[formattedField] = true;
    }

    return [{ $project: project }];
  }
}
