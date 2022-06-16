import mongoose from 'mongoose';

const connectionString = 'mongodb://root:password@localhost:27027';
const connection = mongoose.createConnection(connectionString);

connection.model(
  'account',
  new mongoose.Schema({
    firstname: String,
    lastname: String,
    storeId: Number,

    address: {
      streetNumber: Number,
      streetName: String,
      city: String,
      country: String,
    },

    bills: [
      {
        title: String,
        amount: Number,
        issueDate: Date,
        items: [
          {
            importance: { type: String, enum: ['high', 'medium', 'low'] },
            title: String,
            amount: Number,
          },
        ],
      },
    ],
  }),
);

export default connection;
