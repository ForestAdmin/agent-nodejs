import { Schema, createConnection } from 'mongoose';

export default async function setupWith2ManyToManyRelations(dbName = 'test') {
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
}
