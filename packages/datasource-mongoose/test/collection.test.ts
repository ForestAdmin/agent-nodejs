import { Model } from 'mongoose';

import { FieldSchema, RecordData } from '@forestadmin/datasource-toolkit';

import MongooseCollection from '../src/collection';
import SchemaFieldsGenerator from '../src/utils/schema-fields-generator';

describe('MongooseCollection', () => {
  describe('buildSchema', () => {
    it('should build the schema', () => {
      const carsModel = {
        schema: {
          paths: {},
        },
      } as Model<RecordData>;

      const mockedFields = {
        field: {} as FieldSchema,
      };
      const spy = jest
        .spyOn(SchemaFieldsGenerator, 'buildSchemaFields')
        .mockReturnValue(mockedFields);
      const mongooseCollection = new MongooseCollection('cars', null, carsModel);

      expect(spy).toHaveBeenCalledWith(carsModel.schema.paths);
      expect(mongooseCollection.schema.fields).toStrictEqual(mockedFields);
    });
  });
});
