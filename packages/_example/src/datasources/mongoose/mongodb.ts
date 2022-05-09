import mongoose from 'mongoose';

const connectionString = 'mongodb://root:password@localhost:27017';
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
      required: true,
    },
    storeId: {
      type: Number,
      required: true,
    },
  }),
);

export default connection;
