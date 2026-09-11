import type { ForestSchemaWithMeta } from '@forestadmin/forestadmin-client';

import { ForestHttpApi, SchemaService } from '@forestadmin/forestadmin-client';

export interface ForestSchemaClientOptions {
  forestServerUrl: string;
  envSecret: string;
}

export interface SchemaFetcher {
  fetchSchema(): Promise<ForestSchemaWithMeta>;
}

export default class ForestSchemaClient implements SchemaFetcher {
  private readonly schemaService: SchemaService;

  constructor({ forestServerUrl, envSecret }: ForestSchemaClientOptions) {
    this.schemaService = new SchemaService(new ForestHttpApi(), { forestServerUrl, envSecret });
  }

  async fetchSchema(): Promise<ForestSchemaWithMeta> {
    return this.schemaService.getSchemaWithMeta();
  }
}
