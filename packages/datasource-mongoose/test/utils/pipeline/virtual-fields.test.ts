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

    model = mongoose.model('books', schema);
  });

  afterAll(() => {
    mongoose.deleteModel('books');
  });

  it('should not add fields that are not within the projection', () => {
    const projection = new Projection();
    const pipeline = VirtualFieldsGenerator.addVirtual(model, null, ['author'], projection);

    expect(pipeline).toEqual([]);
  });

  it('should add virtual fields fake many to one', () => {
    const projection = new Projection('author:_id', 'author:_pid');
    const pipeline = VirtualFieldsGenerator.addVirtual(model, null, ['author'], projection);

    expect(pipeline).toEqual([
      {
        $addFields: {
          'author._id': { $concat: [{ $toString: '$_id' }, '.author'] },
          'author._pid': '$_id',
        },
      },
    ]);
  });

  it('should add virtual fields on boxed many to one', () => {
    const projection = new Projection('title:_id', 'title:_pid', 'title:content');
    const pipeline = VirtualFieldsGenerator.addVirtual(model, null, ['title'], projection);

    expect(pipeline).toEqual([
      {
        $addFields: {
          'title._id': { $concat: [{ $toString: '$_id' }, '.title'] },
          'title._pid': '$_id',
          'title.content': '$title',
        },
      },
    ]);
  });

  it('should work on nested dependencies (for server-side queries only)', () => {
    const projection = new Projection(
      'author:country:_id',
      'author:country:_pid',
      'author:country:name',
    );
    const pipeline = VirtualFieldsGenerator.addVirtual(model, null, ['author'], projection);

    expect(pipeline).toEqual([
      {
        $addFields: {
          'author.country._id': { $concat: [{ $toString: '$_id' }, '.author.country'] },
          'author.country._pid': { $concat: [{ $toString: '$_id' }, '.author'] },
        },
      },
    ]);
  });
});
