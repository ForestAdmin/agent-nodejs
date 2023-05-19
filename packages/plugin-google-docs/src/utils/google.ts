import { docs, docs_v1 } from '@googleapis/docs';
import { drive, drive_v3 } from '@googleapis/drive';

import { Options } from '../types';

export default class Client {
  private client: docs_v1.Docs;
  private service: drive_v3.Drive;

  constructor(options: Options['google']) {
    this.client = docs({ version: 'v1', auth: options.auth });
    this.service = drive({ version: 'v3', auth: options.auth });
  }

  async exportToPdf(fileId: string): Promise<Buffer> {
    // https://developers.google.com/drive/api/reference/rest/v3/files/export
    const buffer = await this.service.files.export({
      fileId,
      mimeType: 'application/pdf',
    });

    return buffer as unknown as Buffer;
  }

  async getFileFromDrive(fileId: string) {
    // https://developers.google.com/drive/api/reference/rest/v3/files/get
    const file = await this.service.files.get({
      fileId,
    });

    return file.data;
  }

  async load(documentId: string): Promise<docs_v1.Schema$Document> {
    const response = await this.client.documents.get({
      documentId,
    });

    return response.data;
  }

  async updates(documentId: string, text: string): Promise<void> {
    await this.client.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [
          {
            insertText: {
              // The first text inserted into the document must create a paragraph,
              // which can't be done with the `location` property.  Use the
              // `endOfSegmentLocation` instead, which assumes the Body if
              // unspecified.
              endOfSegmentLocation: {},
              text,
            },
          },
        ],
      },
    });
  }

  async create(originId: string): Promise<string> {
    // The initial call to create the doc will have a title but no content.
    // This is a limitation of the underlying API.
    const createResponse = await this.client.documents.create({
      requestBody: {
        title: `Your new document for ${originId}!`,
      },
    });

    return createResponse.data.documentId;
  }
}
