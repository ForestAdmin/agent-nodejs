import { Schema, Types, createConnection } from 'mongoose';

export default async function setupWithManyToOneRelation(dbName = 'test') {
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
}
