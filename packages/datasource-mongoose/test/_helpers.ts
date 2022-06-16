/* eslint-disable import/prefer-default-export */
import { Model, Schema, Types, createConnection, deleteModel, model } from 'mongoose';
import { RecordData } from '@forestadmin/datasource-toolkit';

export const buildModel = (schema: Schema, modelName = 'aModel'): Model<RecordData> => {
  try {
    deleteModel(modelName);
    // eslint-disable-next-line no-empty
  } catch {}

  return model(modelName, schema);
};

export const setupReview = async (dbName = 'test') => {
  const connectionString = 'mongodb://root:password@localhost:27019';
  const connection = createConnection(connectionString, { dbName });

  connection.model(
    'review',
    new Schema({
      title: { type: String },
      message: { type: String },
      rating: { type: Number },
      tags: { type: [String] },
      createdDate: { type: Date },
      modificationDates: { type: [Date] },
      editorIds: { type: [Types.ObjectId] },
      authorId: { type: Types.ObjectId },
      nestedField: new Schema({ nested: [new Schema({ level: Number })] }),
    }),
  );
  await connection.dropDatabase();

  return connection;
};

export const setupWithManyToOneRelation = async (dbName = 'test') => {
  const connectionString = 'mongodb://root:password@localhost:27019';
  const connection = createConnection(connectionString, { dbName });

  connection.model(
    'owner',
    new Schema({
      storeId: { type: Types.ObjectId, ref: 'store' },
      name: { type: String },
    }),
  );

  connection.model(
    'store',
    new Schema({
      name: { type: String },
      addressId: { type: Types.ObjectId, ref: 'address' },
    }),
  );

  connection.model('address', new Schema({ name: { type: String } }));

  await connection.dropDatabase();

  return connection;
};

export const setupWith2ManyToManyRelations = async (dbName = 'test') => {
  const connectionString = 'mongodb://root:password@localhost:27019';
  const connection = createConnection(connectionString, { dbName });

  connection.model(
    'owner',
    new Schema({
      stores: { type: [Schema.Types.ObjectId], ref: 'store' },
      oldStores: { type: [Schema.Types.ObjectId], ref: 'store' },
      name: { type: String },
    }),
  );

  connection.model('store', new Schema({ name: { type: String } }));

  await connection.dropDatabase();

  return connection;
};
