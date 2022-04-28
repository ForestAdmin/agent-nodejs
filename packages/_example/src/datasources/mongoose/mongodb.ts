import mongoose from 'mongoose';

export default async function prepareDatabase(): Promise<mongoose.Connection> {
  const connectionString = 'mongodb://root:password@localhost:27017';
  const mongooseInstance = await mongoose.connect(connectionString);

  mongooseInstance.model(
    'review',
    new mongoose.Schema({
      title: {
        type: String,
        required: true,
      },
      message: {
        type: String,
        required: true,
      },
      storeId: {
        type: Number,
        required: true,
      },
    }),
  );

  return mongooseInstance.connection;
}
