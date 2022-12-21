The S3 plugin makes it easy to upload files to Amazon S3 from your administration panel.

It is configurable so that you may choose

- Permission level (public, private, ...)
- Where files should be stored
- Either if replaced files should be kept or deleted

```javascript
import { createAgent } from '@forestadmin/agent';
import { createFileField } from '@forestadmin/plugin-s3';

createAgent().customizeCollection('accounts', collection =>
  collection.use(createFileField, {
    /** Name of the field that you want to use as a file-picker on the frontend */
    fieldname: 'avatar',

    /**
     * Where should the file be stored on S3?
     * Defaults to '<collection_name>/<field_name>/`.
     */
    storeAt: (recordId, originalFilename) => `accounts/${recordId}/${originalFilename}`,

    /** Either if old files should be deleted when updating or deleting a record. */
    deleteFiles: false,

    /**
     * 'url' (the default) will cause urls to be transmitted to the frontend. You final users
     * will download the file from S3.
     *
     * 'proxy' will cause files to be routed by the agent. Use this option only if you are
     * dealing with small files and are behind an entreprise proxy which forbids direct
     * access to S3.
     */
    readMode: 'url',

    /**
     * Which ACL to use on the uploaded objects.
     * Default is "private" (urls will be signed so that the files can be reached from the frontend).
     *
     * Valid values are "authenticated-read", "aws-exec-read", "bucket-owner-full-control",
     * "bucket-owner-read", "private", "public-read", "public-read-write".
     *
     * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/clients/client-s3/globals.html#objectcannedacl
     */
    acl: 'private',

    /** AWS configuration */
    aws: {
      /** AWS access key, defaults to process.env.AWS_ACCESS_KEY_ID. */
      accessKeyId: 'AKIA.........',

      /** AWS secret, defaults to process.env.AWS_ACCESS_KEY_SECRET. */
      secretAccessKey: '123.......',

      /** AWS region, defaults to process.env.AWS_DEFAULT_REGION. */
      region: 'eu-west-1',

      /** AWS bucket, defaults to process.env.AWS_S3_BUCKET */
      bucket: 'my-bucket',
    },
  }),
);
```
