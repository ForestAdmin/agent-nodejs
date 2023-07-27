import { DataSource } from '@forestadmin/datasource-toolkit';
import { Client } from '@hubspot/api-client';
import dotenv from 'dotenv';

import { HubSpotOptions, createHubspotDataSource } from '../../../src';

const path = `${__dirname}/../../externals/.env`;
dotenv.config({ path });

export default class Hubspot {
  private client: Client;

  constructor() {
    this.client = new Client({ accessToken: process.env.HUBSPOT_API_KEY });
  }

  async createRecord(collectionName: string, record: any) {
    return this.client.crm[collectionName].basicApi.create(record);
  }

  async deleteRecord(collectionName: string, recordId: string) {
    return this.client.crm[collectionName].basicApi.archive(recordId);
  }

  async deleteAllRecords(collectionName: string) {
    const records = await this.getAllRecords(collectionName);

    return Promise.all(records.map((record: any) => this.deleteRecord(collectionName, record.id)));
  }

  updateRecord(collectionName: string, id: string, record: any) {
    return this.client.crm[collectionName].basicApi.update(id, record);
  }

  async fetchRecord(collectionName: string, id: string) {
    return this.client.crm[collectionName].basicApi.getById(id);
  }

  async getAllRecords(collectionName: string) {
    // fix: it get only the first 100 records
    return this.client.crm[collectionName].getAll();
  }

  static async makeDatasource(
    options: Partial<HubSpotOptions>,
    logger = jest.fn(),
  ): Promise<DataSource> {
    const factory = createHubspotDataSource({
      accessToken: process.env.HUBSPOT_API_KEY,
      ...options,
    } as HubSpotOptions);

    return factory(logger);
  }

  private static makeClient() {}
}
