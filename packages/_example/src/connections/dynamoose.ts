import dynamoose from 'dynamoose';

dynamoose.aws.sdk.config.update({
  accessKeyId: 'AKID',
  secretAccessKey: 'SECRET',
  region: 'us-east-1',
});

dynamoose.aws.ddb.local('http://localhost:8000');

const WithHashKey = dynamoose.model(
  'WithHashKey',
  {
    userId: { type: String, hashKey: true },
    title: String,
    content: String,
    createdAt: { type: String },
    updatedAt: String,
    sub: {
      type: Object,
      schema: {
        field1: String,
        field2: String,
      },
    },
  },
  { create: true },
);

const WithHashRangeKey = dynamoose.model(
  'WithHashRangeKey',
  {
    userId: { type: String, hashKey: true },
    title: String,
    content: String,
    createdAt: { type: String, rangeKey: true },
    updatedAt: String,
    sub: {
      type: Object,
      schema: {
        field1: String,
        field2: String,
      },
    },
  },
  { create: true },
);

export default [WithHashKey, WithHashRangeKey];
