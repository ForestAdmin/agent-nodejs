import { Connection, Model, Schema, deleteModel, model } from 'mongoose';
import { RecordData } from '@forestadmin/datasource-toolkit';

import MongooseCollection from '../../src/collections/collection';
import MongooseDatasource from '../../src/datasource';
import NestedCollectionGenerator from '../../src/utils/nested-collection-generator';

const buildModel = (schema: Schema, modelName = 'aModel'): Model<RecordData> => {
  try {
    deleteModel(modelName);
    // eslint-disable-next-line no-empty
  } catch {}

  return model(modelName, schema);
};

describe('NestedCollectionGenerator', () => {
  describe('addInverseRelationships', () => {
    it('should throw an error when the ref does not exist', () => {
      const schemaWithManyToOne = new Schema({
        aFieldTarget: { type: Schema.Types.ObjectId, ref: 'modelDoesNotExist' },
      });

      const dataSource = new MongooseDatasource({ models: {} } as Connection);
      const modelA = buildModel(schemaWithManyToOne, 'modelA');
      const collectionA = new MongooseCollection(dataSource, modelA);

      expect(() =>
        NestedCollectionGenerator.addNewCollectionAndInverseRelationships([collectionA]),
      ).toThrow("Collection 'modelDoesNotExist' not found.");
    });
  });
});
