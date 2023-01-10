import { Schema, Types, createConnection } from 'mongoose';

export const setupReview = async (dbName = 'test') => {
  const connectionString = 'mongodb://root:password@localhost:27019';
  const connection = createConnection(connectionString, { dbName });

  connection.model(
    'review',
    new Schema({
      title: {
        type: String,
        validate: {
          validator: v => v !== 'forbidden title',
          message: 'title cannot be "forbidden title"',
        },
      },
      message: { type: String },
      rating: { type: Number },
      tags: { type: [String] },
      createdDate: { type: Date },
      modificationDates: { type: [Date] },
      editorIds: { type: [Types.ObjectId] },
      authorId: { type: Types.ObjectId },
      nestedField: new Schema({ nested: [new Schema({ level: Number })], other: String }),
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
