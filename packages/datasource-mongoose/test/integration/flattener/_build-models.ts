import { Schema, createConnection } from 'mongoose';

export default async function setupFlattener(dbName = 'test') {
  const connectionString = 'mongodb://root:password@localhost:27019';
  const connection = createConnection(connectionString, { dbName });

  connection.model(
    'cars',
    new Schema({
      name: String,
      wheelSize: Number,
      engine: {
        identification: {
          manufacturer: { type: String, enum: ['Toyota', 'Renault'], default: 'Toyota' },
          date: Date,
          company: { type: Schema.Types.ObjectId, ref: 'companies' },
        },
        fuel: new Schema({
          capacity: Number,
          category: { type: String, enum: ['EXPLOSION', 'ELECTRIC'], default: 'EXPLOSION' },
        }),
        horsePower: String,
        owner: { type: Schema.Types.ObjectId, ref: 'companies' },
        comments: [{ date: Date, comment: String }],
        companies: [{ type: Schema.Types.ObjectId, ref: 'companies' }],
      },
      company: { type: Schema.Types.ObjectId, ref: 'companies' },
      testNotDeep: [{ type: Schema.Types.ObjectId, ref: 'companies' }],
    }),
  );

  connection.model(
    'companies',
    new Schema({
      name: String,
      address: {
        street: String,
      },
    }),
  );

  await connection.dropDatabase();

  return connection;
}
