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
    const projection = new Projection('author:_id', 'author:parentId');
    const pipeline = VirtualFieldsGenerator.addVirtual(model, null, ['author'], projection);

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
    const pipeline = VirtualFieldsGenerator.addVirtual(model, null, ['title'], projection);

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

  it('should add nested dependencies (for server-side queries only)', () => {
    const projection = new Projection(
      'author:country:_id',
      'author:country:parentId',
      'author:country:name',
    );
    const pipeline = VirtualFieldsGenerator.addVirtual(model, null, ['author'], projection);

    expect(pipeline).toEqual([
      {
        $addFields: {
          'author.country._id': { $concat: [{ $toString: '$_id' }, '.author.country'] },
          'author.country.parentId': { $concat: [{ $toString: '$_id' }, '.author'] },
        },
      },
    ]);
  });
});
