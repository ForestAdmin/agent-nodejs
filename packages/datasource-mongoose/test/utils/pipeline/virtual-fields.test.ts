import { Projection } from '@forestadmin/datasource-toolkit';
import mongoose, { Model, Schema } from 'mongoose';

import VirtualFieldsGenerator from '../../../src/utils/pipeline/virtual-fields';

describe('VirtualFieldsGenerator', () => {
  let model: Model<unknown>;

  beforeAll(() => {
    const schema = new Schema({
      title: String,
      author: {
        firstname: String,
        lastname: String,
        country: { name: String },
      },
    });

    model = mongoose.model<unknown>('books', schema);
  });

  afterAll(() => {
    mongoose.deleteModel('books');
  });

  it('should not add fields that are not within the projection', () => {
    const projection = new Projection();
    const stack = [{ prefix: null, asFields: [], asModels: ['author'] }];
    const pipeline = VirtualFieldsGenerator.addVirtual(model, stack, projection);

    expect(pipeline).toEqual([]);
  });

  it('should add virtual fields fake many to one', () => {
    const projection = new Projection('author:_id', 'author:parentId');
    const stack = [{ prefix: null, asFields: [], asModels: ['author'] }];
    const pipeline = VirtualFieldsGenerator.addVirtual(model, stack, projection);

    expect(pipeline).toEqual([
      {
        $addFields: {
          'author._id': { $concat: [{ $toString: '$_id' }, '.author'] },
          'author.parentId': '$_id',
        },
      },
    ]);
  });

  it('should add virtual fields on boxed many to one', () => {
    const projection = new Projection('title:_id', 'title:parentId', 'title:content');
    const stack = [{ prefix: null, asFields: [], asModels: ['title'] }];
    const pipeline = VirtualFieldsGenerator.addVirtual(model, stack, projection);

    expect(pipeline).toEqual([
      {
        $addFields: {
          'title._id': { $concat: [{ $toString: '$_id' }, '.title'] },
          'title.parentId': '$_id',
          'title.content': '$title',
        },
      },
    ]);
  });

  it('should add nested dependencies besides for parentId (for server-side queries only)', () => {
    const projection = new Projection('author:country:_id', 'author:country:name');
    const stack = [{ prefix: null, asFields: [], asModels: ['author'] }];
    const pipeline = VirtualFieldsGenerator.addVirtual(model, stack, projection);

    expect(pipeline).toEqual([
      {
        $addFields: {
          'author.country._id': { $concat: [{ $toString: '$_id' }, '.author.country'] },
        },
      },
    ]);
  });

  it('should crash on nested parentId (for server-side queries only)', () => {
    const projection = new Projection('author:country:parentId');
    const stack = [{ prefix: null, asFields: [], asModels: ['author'] }];
    const fn = () => VirtualFieldsGenerator.addVirtual(model, stack, projection);

    expect(fn).toThrow('Fetching virtual parentId deeper than 1 level is not supported.');
  });
});
