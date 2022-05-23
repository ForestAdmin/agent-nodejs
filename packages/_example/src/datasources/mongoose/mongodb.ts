import mongoose, { Schema } from 'mongoose';

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
    },
    rating: {
      type: Number,
    },
    storeId: {
      type: Number,
      required: true,
    },
    testArrayIds: {
      type: [Number],
    },
    ownerIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'ownerMongo',
    },
    oldOwnerIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'ownerMongo',
    },
  }),
);

connection.model(
  'ownerMongo',
  new Schema({
    name: {
      type: String,
    },
  }),
);

export default connection;
