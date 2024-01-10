import { Logger } from '@forestadmin/datasource-toolkit';

import ExternalFileFieldError from '../errors';
import { File, IClient } from '../types';

export default class Client {
  private client: IClient;
  private logger: Logger;

  constructor(client: IClient, logger: Logger) {
    if (!client || !client.getUrlFromKey || !client.load || !client.save) {
      throw new Error(
        'Your configuration is incorrect' +
          ', Please ensure the given client implements the IClient interface.',
      );
    }

    this.client = client;
    this.logger = logger;
  }

  async getUrlFromKey(key: string): Promise<string> {
    try {
      this.logger('Debug', `Get signed url for ${key}`);

      const response = await this.client.getUrlFromKey(key);

      return response;
    } catch (error) {
      throw new ExternalFileFieldError(error.message);
    }
  }

  async load(key: string): Promise<File> {
    try {
      this.logger('Debug', `Download ${key} file`);

      const response = await this.client.load(key);

      return response;
    } catch (error) {
      throw new ExternalFileFieldError(error.message);
    }
  }

  async save(key: string, file: File): Promise<void> {
    try {
      this.logger('Debug', `Upload ${key} file`);

      await this.client.save(key, file);
    } catch (error) {
      throw new ExternalFileFieldError(error.message);
    }
  }
}
