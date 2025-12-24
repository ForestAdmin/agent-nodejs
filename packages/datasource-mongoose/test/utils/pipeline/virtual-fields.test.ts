import type { Model } from 'mongoose';

import { Projection } from '@forestadmin/datasource-toolkit';
import mongoose, { Schema } from 'mongoose';

import ConditionGenerator from '../../../src/utils/pipeline/condition-generator';
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
          'author._id': ConditionGenerator.tagRecordIfNotExistByValue('author', {
            $concat: [{ $toString: '$_id' }, '.author'],
          }),
          'author.parentId': ConditionGenerator.tagRecordIfNotExistByValue('author', '$_id'),
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
          'title._id': ConditionGenerator.tagRecordIfNotExistByValue('title', {
            $concat: [{ $toString: '$_id' }, '.title'],
          }),
          'title.parentId': ConditionGenerator.tagRecordIfNotExistByValue('title', '$_id'),
          'title.content': '$title',
        },
      },
    ]);
  });

  it('should add nested dependencies besides for parentId (for server-side queries only)', () => {
    const projection = new Projection('author:country:_id');
    const stack = [{ prefix: null, asFields: [], asModels: ['author'] }];
    const pipeline = VirtualFieldsGenerator.addVirtual(model, stack, projection);

    expect(pipeline).toEqual([
      {
        $addFields: {
          'author.country._id': ConditionGenerator.tagRecordIfNotExistByValue('author.country', {
            $concat: [{ $toString: '$_id' }, '.author.country'],
          }),
        },
      },
    ]);
  });

  it('should add nested dependencies', () => {
    const projection = new Projection('author:country:name');
    const stack = [{ prefix: null, asFields: [], asModels: ['author'] }];
    const pipeline = VirtualFieldsGenerator.addVirtual(model, stack, projection);

    expect(pipeline).toEqual([
      {
        $addFields: {
          'author.country.name': ConditionGenerator.tagRecordIfNotExistByValue(
            'author.country',
            '$author.country.name',
          ),
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
