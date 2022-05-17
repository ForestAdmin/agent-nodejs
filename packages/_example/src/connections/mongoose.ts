import mongoose from 'mongoose';

const connectionString = 'mongodb://root:password@localhost:27027';
const connection = mongoose.createConnection(connectionString);

connection.model(
  'review',
  new mongoose.Schema({
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
    },
    rating: {
      type: Number,
    },
    storeId: {
      type: Number,
      required: true,
    },
  }),
);

export default connection;
