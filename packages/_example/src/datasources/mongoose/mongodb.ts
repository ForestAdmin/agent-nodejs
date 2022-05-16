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
    },
    storeId: {
      type: Number,
      required: true,
    },
    relationReview: { type: mongoose.Schema.Types.ObjectId, ref: 'relationReview' },
  }),
);

connection.model(
  'relationReview',
  new mongoose.Schema({
    aField: {
      type: String,
    },
    aDate: {
      type: Date,
    },
  }),
);

export default connection;
