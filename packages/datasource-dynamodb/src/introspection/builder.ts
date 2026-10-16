import type {
  EntityDefinition,
  IntrospectionConfig,
  OverrideTypeConverter,
  ScanPolicy,
  TableModel,
} from '../types';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

import { introspectTable } from './introspector';

export type TableCollectionOptions = {
  /** Name of the collection in Forest Admin. */
  name: string;
  tableName: string;
  sampleSize?: number;
  maxDepth?: number;
  /** Keeps the collection to a part of a table shared with other collections. */
  entity?: EntityDefinition;
  /** Allows the pagination to show the number of pages, at the cost of counting. Default: true. */
  enableCount?: boolean;
  scanPolicy?: ScanPolicy;
  maxScannedItems?: number;
  overrideTypeConverter?: OverrideTypeConverter;
};

export interface DynamoDBDatasourceOptionsBuilder {
  addCollectionFromTable(options: TableCollectionOptions): this;
}

export type ConfigurationOptions = (
  configurator: DynamoDBDatasourceOptionsBuilder,
) => DynamoDBDatasourceOptionsBuilder;

/** Adds collections one table at a time, to name them or to share a table between several. */
export class DynamoDBDatasourceBuilder implements DynamoDBDatasourceOptionsBuilder {
  private readonly pending: Array<Promise<TableModel>> = [];

  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly defaults: IntrospectionConfig = {},
  ) {}

  addCollectionFromTable(options: TableCollectionOptions): this {
    const { name, ...rest } = options;

    this.pending.push(
      introspectTable(this.client, {
        ...this.defaults,
        ...rest,
        collectionName: name,
      }),
    );

    return this;
  }

  createCollectionsFromConfiguration(): Promise<TableModel[]> {
    return Promise.all(this.pending);
  }
}
