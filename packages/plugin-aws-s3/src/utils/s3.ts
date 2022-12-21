import {
  DeleteObjectCommand,
  GetObjectCommand,
  ObjectCannedACL,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Readable } from 'stream';

import { File, Options } from '../types';

export default class Client {
  private client: S3Client;
  private bucket: string;

  constructor(options: Options['aws']) {
    this.bucket = options?.bucket ?? process.env.AWS_S3_BUCKET;
    this.client = new S3Client({
      region: options?.region ?? process.env.AWS_DEFAULT_REGION,
      credentials: {
        accessKeyId: options?.accessKeyId ?? process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: options?.secretAccessKey ?? process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }

  getPublicUrl(key: string): string {
    return `https://${this.bucket}.s3.${this.client.config.region}.amazonaws.com/${key}`;
  }

  async getSignedUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({ Bucket: this.bucket, Key: key });

    return getSignedUrl(this.client, command, { expiresIn: 5 * 60 });
  }

  async load(Key: string): Promise<File> {
    const getObjectCommand = new GetObjectCommand({ Bucket: this.bucket, Key });
    const response = await this.client.send(getObjectCommand);
    const name = Key.substring(Key.lastIndexOf('/') + 1);

    return new Promise((resolve, reject) => {
      // Store all of data chunks returned from the response data stream
      // into an array then use Array#join() to use the returned contents as a String
      const chunks = [];
      const body = response.Body as Readable;

      // Handle an error while streaming the response body
      body.once('error', err => reject(err));

      // Attach a 'data' listener to add the chunks of data to our array
      // Each chunk is a Buffer instance
      body.on('data', chunk => chunks.push(chunk));

      // Once the stream has no more data, join the chunks into a string and return the buffer
      body.once('end', () =>
        resolve({
          buffer: Buffer.concat(chunks),
          mimeType: response.ContentType,
          name,
        }),
      );
    });
  }

  async save(Key: string, file: File, acl: ObjectCannedACL): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        ACL: acl,
        Body: file.buffer,
        Bucket: this.bucket,
        ContentType: file.mimeType,
        Key,
      }),
    );
  }

  async delete(Key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key }));
  }
}
