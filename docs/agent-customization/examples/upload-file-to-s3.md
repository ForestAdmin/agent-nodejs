This example shows how to upload a file to a S3 bucket.

To illustrate our example, imagine we have a User collection with an avatar string field. This field will store the s3
URL of the avatar.

## Create an AWS service

You must install the [AWS SDK](https://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/node-sdk-install.html).

```bash
npm install aws-sdk
```

You can copy/paste this custom AWS service in your agent to use it.

```javascript
class AwsS3Service {
  constructor({ accessKeyId, secretAccessKey, bucket }) {
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.bucket = bucket;
  }

  async upload(file, path) {
    const { Location } = await this.client
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

  getUrlSignedUrlFromPath(path) {
    return this.client.getSignedUrl('getObject', {
      Bucket: this.bucket,
      Key: path,
      Expires: 600,
    });
  }

  get client() {
    return new AWS.S3({
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });
  }
}
```

Then, instantiate the AWS service.

```javascript
const config = {
  accessKeyId: '...',
  secretAccessKey: '...',
  bucket: '...',
};
const s3 = new AwsS3Service(config);
```

## Add a method to decode the data URI given by the client

Our data URI are not conventional because we have added the file name.

```javascript
function parseDataUri(dataUri) {
  if (!dataUri) return null;

  const [header, data] = dataUri.substring(5).split(',');
  const [mimeType, ...mediaTypes] = header.split(';');
  const result = { mimeType, buffer: Buffer.from(data, 'base64') };

  for (const mediaType of mediaTypes) {
    const index = mediaType.indexOf('=');
    if (index !== -1)
      result[mediaType.substring(0, index)] = decodeURIComponent(mediaType.substring(index + 1));
  }

  return result;
}
```

## Customize the field

First, we need to create a new field which will sign the url of the avatar to send to the client.

```javascript
collection.addField('signedAvatar', {
  columnType: 'String',
  dependencies: ['avatar'],
  getValues: records =>
    records.map(record => {
      // get the path stored in s3. The `pathname` starts with a `/` that's why we need to remove it.
      const path = decodeURI(new URL(record.avatar).pathname.substring(1));
      return s3.getUrlSignedUrlFromPath(path);
    }),
});
```

Then, we replace the field writing to store the new s3 url.

```javascript
collection.replaceFieldWriting('signedAvatar', async (newAvatarFile, context) => {
  if (!newAvatarFile) return { avatar: null };

  // compute an unique path to avoid collision when uploading the same file twice for a different record.
  const uniquePath = `owner/${context.record.id}`;
  // upload to s3 and get the url
  const avatar = await s3.upload(parseDataUri(newAvatarFile), uniquePath);

  // save the decoded url in the database
  return { avatar: decodeURI(avatar) };
});
```

Finally, we want to replace the avatar field by the signedAvatar field.

```javascript
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

```javascript
function parseDataUri(dataUri) {
  if (!dataUri) return null;

  const [header, data] = dataUri.substring(5).split(',');
  const [mimeType, ...mediaTypes] = header.split(';');
  const result = { mimeType, buffer: Buffer.from(data, 'base64') };

  for (const mediaType of mediaTypes) {
    const index = mediaType.indexOf('=');
    if (index !== -1)
      result[mediaType.substring(0, index)] = decodeURIComponent(mediaType.substring(index + 1));
  }

  return result;
}

class AwsS3Service {
  constructor({ accessKeyId, secretAccessKey, bucket }) {
    this.accessKeyId = accessKeyId;
    this.secretAccessKey = secretAccessKey;
    this.bucket = bucket;
  }

  async upload(file, path) {
    const { Location } = await this.client
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

  getUrlSignedUrlFromPath(path) {
    return this.client.getSignedUrl('getObject', {
      Bucket: this.bucket,
      Key: path,
      Expires: 600,
    });
  }

  get client() {
    return new AWS.S3({
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
    });
  }
}

const config = {
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
      ),
  })
  .replaceFieldWriting('signedAvatar', async (newAvatarFile: string, context) => {
    if (!newAvatarFile) return { avatar: null };

    const uniquePath = `owner/${context.record.id}`;
    const avatar = await s3.upload(parseDataUri(newAvatarFile), uniquePath);

    return { avatar: decodeURI(avatar) };
  })
  .removeField('avatar')
  .renameField('signedAvatar', 'avatar');
```
