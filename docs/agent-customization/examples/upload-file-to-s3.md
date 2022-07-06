This example show how to upload a file to an S3 bucket.

To illustrate our example, imagine we have a User collection with an avatar string field. This field will store the s3
url of the avatar.

## Create an AWS service

You must install the [AWS SDK](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/node-sdk-install.html)

```bash
npm install aws-sdk
```

You can copy/past this custom AWS service in your agent to use it.

```typescript
type AwsS3Configuration = {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};


class AwsS3Service {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly bucket: string;

  constructor(configuration: AwsS3Configuration) {
    this.accessKeyId = configuration.accessKeyId;
    this.secretAccessKey = configuration.secretAccessKey;
    this.bucket = configuration.bucket;
  }

  async upload(file: File, path: string): Promise<string> {
    const {Location} = await this.client
      .upload({
        Bucket: this.bucket,
        Key: `${path}/${file.name}`,
        Body: file.buffer,
        ContentType: file.mimeType,
        ACL: 'private',
      })
      .promise();

    return Location;
  }

  getUrlSignedUrlFromPath(path: string): string {
    return this.client.getSignedUrl('getObject', {
      Bucket: this.bucket,
      Key: path,
      Expires: 600,
    });
  }

  private get client(): AWS.S3 {
    return new AWS.S3({
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });
  }
}
```

Instantiate the AWS service.

```javascript
const config: AwsS3Configuration = {
  accessKeyId: '...',
  secretAccessKey: '...',
  bucket: '...',
};
const s3 = new AwsS3Service(config);
```

## Add a method to decode the date uri given by the client

Our data uri is not conventional because we have added the file name.

```typescript
function parseDataUri(dataUri: string): File {
  if (!dataUri) return null;

  const [header, data] = dataUri.substring(5).split(',');
  const [mimeType, ...mediaTypes] = header.split(';');
  const result = {mimeType, buffer: Buffer.from(data, 'base64')};

  for (const mediaType of mediaTypes) {
    const index = mediaType.indexOf('=');
    if (index !== -1)
      result[mediaType.substring(0, index)] = decodeURIComponent(mediaType.substring(index + 1));
  }

  return result as File;
}
```

## Customize the field

First, we need to create a new field which will sign the url of the avatar to send to the client.

```typescript
collection.addField('signedAvatar', {
    columnType: 'String',
    dependencies: ['avatar'],
    getValues: records =>
      records.map(record => {
        // get the path stored in s3. The `pathname` is started with `/` that's why we need to remove it.
        const path = decodeURI(new URL(record.avatar).pathname.substring(1));
        return s3.getUrlSignedUrlFromPath(path);
      })
    }
  )
```

Then, we replace the field writing to store the new s3 url.

```typescript
collection
  .replaceFieldWriting('signedAvatar', async (newAvatarFile: string, context) => {
    if (!newAvatarFile) return {avatar: null};

    // compute an unique path to avoid colision when uploading the same file twice for a different record.
    const uniquePath = `owner/${context.record.id}`;
    // upload to s3 and get the url
    const avatar = await s3.upload(parseDataUri(newAvatarFile), uniquePath);

    // save the decoded url in the database
    return {avatar: decodeURI(avatar)};
  })
```

Finally, we want to replace the avatar field by the signedAvatar field.

```typescript
collection
  // remove the old field
  .removeField('avatar')
  // replace the old field by the new one
  .renameField('signedAvatar', 'avatar');
```

## Custom avatar field on the forestadmin dashboard

You should edit your `avatar` field to use a file picker when you edit it and display the file when
you want to display it.

For this, you need to `Edit layout`, then go to your collection settings, go to the `field` section,
select the `avatar` field, and in the subsection `EDIT SETTINGS` select `File picker` for the `Select edit widget`
and the other subsection `DISPLAY SETTINGS` select `File viewer` for the `Select display widget`.

## All the code

```typescript
function parseDataUri(dataUri) {
  if (!dataUri) return null;

  const [header, data] = dataUri.substring(5).split(',');
  const [mimeType, ...mediaTypes] = header.split(';');
  const result = {mimeType, buffer: Buffer.from(data, 'base64')};

  for (const mediaType of mediaTypes) {
    const index = mediaType.indexOf('=');
    if (index !== -1)
      result[mediaType.substring(0, index)] = decodeURIComponent(mediaType.substring(index + 1));
  }

  return result;
}

type AwsS3Configuration = {
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
};

class AwsS3Service {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly bucket: string;

  constructor(configuration: AwsS3Configuration) {
    this.accessKeyId = configuration.accessKeyId;
    this.secretAccessKey = configuration.secretAccessKey;
    this.bucket = configuration.bucket;
  }

  async upload(file: File, path: string): Promise<string> {
    const {Location} = await this.client
      .upload({
        Bucket: this.bucket,
        Key: `${path}/${file.name}`,
        Body: file.buffer,
        ContentType: file.mimeType,
        ACL: 'private',
      })
      .promise();

    return Location;
  }

  getUrlSignedUrlFromPath(path: string): string {
    return this.client.getSignedUrl('getObject', {
      Bucket: this.bucket,
      Key: path,
      Expires: 600,
    });
  }

  private get client(): AWS.S3 {
    return new AWS.S3({
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });
  }
}

const config: AwsS3Configuration = {
  accessKeyId: '...',
  secretAccessKey: '...',
  bucket: '...',
};
const s3 = new AwsS3Service(config);

collection
  .addField('signedAvatar', {
      columnType: 'String',
      dependencies: ['avatar'],
      getValues: records =>
        records.map(record =>
          s3.getUrlSignedUrlFromPath(decodeURI(new URL(record.avatar).pathname.substring(1))),
        )
    }
  ).replaceFieldWriting('signedAvatar', async (newAvatarFile: string, context) => {
  if (!newAvatarFile) return {avatar: null};

  const uniquePath = `owner/${context.record.id}`;
  const avatar = await s3.upload(parseDataUri(newAvatarFile), uniquePath);

  return {avatar: decodeURI(avatar)};
}).removeField('avatar')
  .renameField('signedAvatar', 'avatar');
```
