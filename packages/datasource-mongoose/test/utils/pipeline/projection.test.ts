import { Projection } from '@forestadmin/datasource-toolkit';
import ProjectionGenerator from '../../../src/utils/pipeline/projection';

describe('ProjectionGenerator', () => {
  it('should generate a $replaceRoot stage when no fields are provided', () => {
    const pipeline = ProjectionGenerator.project(new Projection());

    expect(pipeline).toEqual([{ $replaceRoot: { newRoot: { $literal: {} } } }]);
  });

  it('should generate a $project stage when fields are provided', () => {
    const pipeline = ProjectionGenerator.project(new Projection('_id', 'title:_id'));

    expect(pipeline).toEqual([{ $project: { _id: true, 'title._id': true } }]);
  });
});
