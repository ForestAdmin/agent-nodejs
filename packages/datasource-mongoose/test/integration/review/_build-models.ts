import { Schema, Types, createConnection } from 'mongoose';

export default async function setupReview(dbName = 'test') {
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
}
