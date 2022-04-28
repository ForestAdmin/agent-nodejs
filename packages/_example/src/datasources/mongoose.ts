import * as mongoose from 'mongoose';

export default async function prepareDatabase(): Promise<mongoose.Mongoose> {
  const connectionString = 'mongodb://localhost:8081/example';
  const mongooseInstance = await mongoose.connect(connectionString);

  mongooseInstance.model(
    'User',
    new mongoose.Schema({
      title: {
        type: String,
        required: true,
      },
      message: {
        type: String,
        required: true,
      },
    }),
  );

  return mongooseInstance;
}
