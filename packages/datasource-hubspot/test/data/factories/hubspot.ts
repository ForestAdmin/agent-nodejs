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

  async createRecord(collectionName: string, properties: Record<string, any>) {
    return this.client.crm[collectionName].basicApi.create({ properties, associations: [] });
  }

  async createRelationship(
    fromCollectionName: string,
    fromRecordId: number,
    toCollectionName: string,
    toRecordId: number,
  ) {
    return this.client.crm.associations.v4.basicApi.create(
      fromCollectionName,
      fromRecordId,
      toCollectionName,
      toRecordId,
      [],
    );
  }

  async deleteRecord(collectionName: string, recordId: string) {
    return this.client.crm[collectionName].basicApi.archive(recordId);
  }

  async deleteAllRecords(collectionName: string) {
    const records = await this.getAllRecords(collectionName);

    return Promise.all(records.map((record: any) => this.deleteRecord(collectionName, record.id)));
  }

  updateRecord(collectionName: string, id: string, properties: Record<string, any>) {
    return this.client.crm[collectionName].basicApi.update(id, { properties });
  }

  async getById(collectionName: string, id: string) {
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
      skipTypings: true,
      ...options,
    } as HubSpotOptions);

    return factory(logger);
  }

  private static makeClient() {}
}
