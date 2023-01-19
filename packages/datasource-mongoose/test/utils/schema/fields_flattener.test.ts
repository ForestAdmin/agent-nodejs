import { Model, Schema } from 'mongoose';

import FieldsGenerator from '../../../src/utils/schema/fields';
import { buildModel } from '../../_helpers';

describe('Construction', () => {
  let model: Model<unknown>;

  beforeEach(async () => {
    model = buildModel(
      new Schema({
        _id: Number,
        name: String,
        contactDetails: {
          email: String,
          phone: { home: String, mobile: String },
        },
        referenceList: [{ type: Schema.Types.ObjectId, ref: 'aModel' }],
        nested: {
          referenceList: [{ type: Schema.Types.ObjectId, ref: 'aModel' }],
          objectList: [{ name: String, contactDetails: { email: String } }],
        },
      }),
    );
  });

  it('should not modify the schema', async () => {
    const fields = FieldsGenerator.buildFieldsSchema(model, [
      { prefix: null, asModels: [], asFields: [] },
    ]);

    expect(Object.keys(fields)).toEqual([
      '_id',
      'name',
      'contactDetails',
      'referenceList',
      'nested',
    ]);
  });

  it('should skip flattened models', async () => {
    const fields = FieldsGenerator.buildFieldsSchema(model, [
      { prefix: null, asFields: ['contactDetails.email'], asModels: ['nested.objectList'] },
    ]);

    expect(Object.keys(fields)).toEqual([
      '_id',
      'name',
      'contactDetails',
      'referenceList',
      'nested',
      'contactDetails@@@email',
    ]);
  });

  it('should flatten all contact details when no level is provided', async () => {
    const fields = FieldsGenerator.buildFieldsSchema(model, [
      {
        prefix: null,
        asFields: [
          'contactDetails.email',
          'contactDetails.phone.home',
          'contactDetails.phone.mobile',
        ],
        asModels: [],
      },
    ]);

    expect(Object.keys(fields)).toEqual([
      '_id',
      'name',
      'referenceList',
      'nested',
      'contactDetails@@@email',
      'contactDetails@@@phone@@@home',
      'contactDetails@@@phone@@@mobile',
    ]);
  });

  it('should flatten only requested fields', async () => {
    const fields = FieldsGenerator.buildFieldsSchema(model, [
      {
        prefix: null,
        asFields: ['contactDetails.email', 'contactDetails.phone.home'],
        asModels: [],
      },
    ]);

    expect(Object.keys(fields)).toEqual([
      '_id',
      'name',
      'contactDetails',
      'referenceList',
      'nested',
      'contactDetails@@@email',
      'contactDetails@@@phone@@@home',
    ]);
  });

  it('should only flatten email and phone when level = 1', async () => {
    const fields = FieldsGenerator.buildFieldsSchema(model, [
      {
        prefix: null,
        asFields: ['contactDetails.email', 'contactDetails.phone'],
        asModels: [],
      },
    ]);

    expect(Object.keys(fields)).toEqual([
      '_id',
      'name',
      'referenceList',
      'nested',
      'contactDetails@@@email',
      'contactDetails@@@phone',
    ]);
  });
});
