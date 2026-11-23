import mongoose from 'mongoose';

import { demoFields, mongooseDefinition } from './data-model';

export const connectionString = 'mongodb://root:password@localhost:27027';
const connection = mongoose.createConnection(connectionString);

export const DOCUMENT_CHECK_FIELDS = {
  check_result: 'result',
  failure_reason: 'failure_reason',
  verified: 'verified',
  verified_by: 'verified_by',
  verified_at: 'verified_at',
  provider_check_id: 'provider_check_id',
};

const DOCUMENT_FIELDS_OUTSIDE_THE_CASE = ['kyc_case_id', 'customer_id', 'information_request_id'];

const checkResults = demoFields('documents').find(field => field.name === 'check_result').enum;

connection.model(
  'kyc_cases',
  new mongoose.Schema({
    ...mongooseDefinition('kyc_cases'),
    applicant_photo: Buffer,
    applicant: {
      first_name: String,
      last_name: String,
      date_of_birth: Date,
      nationality: String,
    },
    documents: [
      {
        ...mongooseDefinition('documents', [
          ...DOCUMENT_FIELDS_OUTSIDE_THE_CASE,
          ...Object.keys(DOCUMENT_CHECK_FIELDS),
        ]),
        check: {
          result: { type: String, enum: checkResults },
          failure_reason: String,
          verified: Boolean,
          verified_by: String,
          verified_at: Date,
          provider_check_id: String,
        },
      },
    ],
  }),
  'kyc_cases',
);

export default connection;
