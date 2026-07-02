import type { ForestSchemaCollection } from '@forestadmin/forestadmin-client';

import { ForestHttpApi, SchemaService } from '@forestadmin/forestadmin-client';

export interface ForestSchemaClientOptions {
  forestServerUrl: string;
  envSecret: string;
}

export interface SchemaFetcher {
  fetchSchema(): Promise<ForestSchemaCollection[]>;
}

export default class ForestSchemaClient implements SchemaFetcher {
  private readonly schemaService: SchemaService;

  constructor({ forestServerUrl, envSecret }: ForestSchemaClientOptions) {
    this.schemaService = new SchemaService(new ForestHttpApi(), { forestServerUrl, envSecret });
  }

  async fetchSchema(): Promise<ForestSchemaCollection[]> {
    return this.schemaService.getSchema();
  }
}
