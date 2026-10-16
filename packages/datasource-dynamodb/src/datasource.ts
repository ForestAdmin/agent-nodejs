import type ArrayCollection from './array-collection';
import type { CollectionSettings, TableModel } from './types';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { Logger } from '@forestadmin/datasource-toolkit';

import { ExecuteStatementCommand } from '@aws-sdk/lib-dynamodb';
import { BaseDataSource, ValidationError } from '@forestadmin/datasource-toolkit';

import DynamoDBCollection from './collection';
import { ScanLimitExceededError } from './errors';

const PLACEHOLDER = /\$(\w+)/g;
const READ_ONLY_STATEMENT = /^\s*select\b/i;

type NativeQueryConnection = { client: DynamoDBDocumentClient };

export default class DynamoDBDataSource extends BaseDataSource<
  DynamoDBCollection | ArrayCollection
> {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    models: TableModel[],
    logger: Logger,
    private readonly settings: CollectionSettings,
    options?: { liveQueryConnection?: string },
  ) {
    super();

    [...models]
      // keeps the schema from being reordered between two starts
      .sort((a, b) => (a.name > b.name ? 1 : -1))
      .forEach(model =>
        this.addCollection(new DynamoDBCollection(this, model, client, logger, settings)),
      );

    if (options?.liveQueryConnection) {
      this.addNativeQueryConnection(options.liveQueryConnection, { client });
    }

    logger('Info', 'DynamoDBDataSource - Built');
  }

  /** Runs a PartiQL SELECT: `$name` placeholders become positional parameters. */
  override async executeNativeQuery(
    connectionName: string,
    query: string,
    contextVariables: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>[]> {
    const connection = this.nativeQueryConnections[connectionName] as NativeQueryConnection;

    if (!connection) throw new ValidationError(`Unknown connection name '${connectionName}'`);

    if (!READ_ONLY_STATEMENT.test(query)) {
      throw new ValidationError('Only SELECT statements can be run as native queries');
    }

    const parameters: unknown[] = [];
    const statement = query.replace(PLACEHOLDER, (_match, name: string) => {
      if (!(name in contextVariables)) {
        throw new ValidationError(`No value was given for the placeholder $${name}`);
      }

      parameters.push(contextVariables[name]);

      return '?';
    });

    const rows: Record<string, unknown>[] = [];
    let nextToken: string;

    do {
      // eslint-disable-next-line no-await-in-loop
      const response = await connection.client.send(
        new ExecuteStatementCommand({
          Statement: statement,
          ...(parameters.length ? { Parameters: parameters as never } : {}),
          ...(nextToken ? { NextToken: nextToken } : {}),
        }),
      );

      rows.push(...((response.Items ?? []) as Record<string, unknown>[]));
      nextToken = response.NextToken;

      if (rows.length > this.settings.maxScannedItems) {
        throw new ScanLimitExceededError(
          `The native query returned more than ${this.settings.maxScannedItems} items, which is ` +
            `maxScannedItems. Narrow the results with a WHERE clause.`,
        );
      }
    } while (nextToken);

    return rows;
  }
}
