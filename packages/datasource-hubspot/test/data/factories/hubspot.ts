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

  async createContact(properties: Record<string, any>) {
    return this.client.crm.contacts.basicApi.create({ properties, associations: [] });
  }

  async createCompany(properties: Record<string, any>) {
    return this.client.crm.companies.basicApi.create({ properties, associations: [] });
  }

  async createDeal(properties: Record<string, any>) {
    return this.client.crm.deals.basicApi.create({ properties, associations: [] });
  }

  async createRecord(collectionName: string, properties: Record<string, any>) {
    return this.getDiscovery(collectionName).basicApi.create({ properties, associations: [] });
  }

  async createFeedbackSubmission(properties: Record<string, any>) {
    return this.client.crm.objects.feedbackSubmissions.basicApi.create({
      properties: {
        hs_submission_timestamp: '1',
        hs_survey_id: '1',
        hs_survey_channel: '1',
        hs_survey_type: '2',
        ...properties,
      },
      associations: [],
    });
  }

  async createLineItem(properties: Record<string, any>) {
    return this.client.crm.lineItems.basicApi.create({
      properties: { ...properties },
      associations: [],
    });
  }

  async createProduct(properties: Record<string, any>) {
    return this.client.crm.products.basicApi.create({
      properties: { ...properties },
      associations: [],
    });
  }

  async createTicket(properties: Record<string, any>) {
    return this.client.crm.tickets.basicApi.create({
      properties: { hs_pipeline_stage: '1', ...properties },
      associations: [],
    });
  }

  async createQuote(properties: Record<string, any>) {
    return this.client.crm.quotes.basicApi.create({
      properties: {
        hs_title: 'forest',
        hs_expiration_date: new Date().toISOString(),
        ...properties,
      },
      associations: [],
    });
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
    return this.getDiscovery(collectionName).basicApi.archive(recordId);
  }

  async deleteAllRecords(collectionName: string) {
    const records = await this.getAllRecords(collectionName);

    return Promise.all(records.map((record: any) => this.deleteRecord(collectionName, record.id)));
  }

  updateRecord(collectionName: string, id: string, properties: Record<string, any>) {
    return this.getDiscovery(collectionName).basicApi.update(id, { properties });
  }

  async getById(collectionName: string, id: string) {
    return this.getDiscovery(collectionName).basicApi.getById(id);
  }

  async getAllRecords(collectionName: string) {
    // fix: it get only the first 100 records
    return (await this.getDiscovery(collectionName).basicApi.getPage()).results;
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

  private getDiscovery(collectionName: string) {
    if (collectionName === 'feedback_submissions') {
      return this.client.crm.objects.feedbackSubmissions;
    }

    if (collectionName === 'line_items') {
      return this.client.crm.lineItems;
    }

    return this.client.crm[collectionName];
  }
}
