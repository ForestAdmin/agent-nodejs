import type { Model } from 'mongoose';

import { Mongoose, Schema, mongo } from 'mongoose';

import OptionsParser from '../../src/utils/options';

describe('Utils > options', () => {
  describe('parseOptions', () => {
    function parseOptionsWithSchema(schema: Schema, flattenMode: 'auto' | 'manual' | 'none') {
      const fakeConnection = new Mongoose();
      fakeConnection.model('things', schema);

      return OptionsParser.parseOptions(fakeConnection.model('things') as Model<unknown>, {
        flattenMode,
      });
    }

    describe('auto', () => {
      it('should flatten all fields which are nested', () => {
        const schema = new Schema({
          _id: { type: mongo.ObjectId, required: true },
          properties: {
            foo: { type: String, required: true },
            bar: { type: String, required: true },
          },
        });

        const options = parseOptionsWithSchema(schema, 'auto');

        expect(options).toEqual({
          asFields: ['properties.foo', 'properties.bar'],
          asModels: [],
        });
      });

      it('should not flatten fields when there is a property with an empty name', () => {
        const schema = new Schema({
          _id: { type: mongo.ObjectId, required: true },
          properties: {
            foo: { type: String, required: true },
            bar: { type: String, required: true },
            '': { type: String, required: true },
          },
        });

        const options = parseOptionsWithSchema(schema, 'auto');

        expect(options).toEqual({
          asFields: [],
          asModels: [],
        });
      });

      it('should not flatten arrays when there is a property with an empty name', () => {
        const schema = new Schema({
          _id: { type: mongo.ObjectId, required: true },
          properties: [
            {
              foo: { type: String, required: true },
              bar: { type: String, required: true },
              '': { type: String, required: true },
            },
          ],
        });

        const options = parseOptionsWithSchema(schema, 'auto');

        expect(options).toEqual({
          asFields: [],
          asModels: [],
        });
      });
    });
  });
});
