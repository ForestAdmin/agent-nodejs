/* eslint-disable max-classes-per-file */
import type { CollectionSettings, TableModel } from '../types';
import type { StartKey } from './pagination-cache';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { Logger } from '@forestadmin/datasource-toolkit';

import { DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import {
  BatchGetCommand,
  BatchWriteCommand,
  GetCommand,
  PutCommand,
  QueryCommand,
  ScanCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';

import { DynamoDBOperationError, ScanLimitExceededError } from '../errors';
import { chunk, mapUntilSettled, sleep } from './concurrency';

export type Item = Record<string, unknown>;

export type ReadOperation = 'query' | 'scan';

export type ReadInput = {
  IndexName?: string;
  KeyConditionExpression?: string;
  FilterExpression?: string;
  ProjectionExpression?: string;
  ExpressionAttributeNames?: Record<string, string>;
  ExpressionAttributeValues?: Record<string, unknown>;
  ScanIndexForward?: boolean;
  Limit?: number;
  Select?: 'COUNT';
  Segment?: number;
  TotalSegments?: number;
  ExclusiveStartKey?: StartKey;
};

export type Page = { items: Item[]; count: number; lastKey?: StartKey };

const BATCH_GET_SIZE = 100;
const BATCH_WRITE_SIZE = 25;
const WRITE_CONCURRENCY = 10;

/** Counts the items a request reads, across the segments of a parallel scan, and caps them. */
export class ReadBudget {
  private scanned = 0;
  private aborted = false;

  constructor(private readonly tableName: string, private readonly max: number) {}

  /** Stops the other segments of a parallel read once one of them has failed. */
  abort(): void {
    this.aborted = true;
  }

  get isAborted(): boolean {
    return this.aborted;
  }

  charge(items: number, operation: ReadOperation): void {
    this.scanned += items;

    if (this.scanned > this.max) {
      throw new ScanLimitExceededError(
        `${operation === 'scan' ? 'Scan' : 'Query'} on table '${this.tableName}' stopped after ` +
          `${this.scanned} items: maxScannedItems is ${this.max}. Narrow the results with filters.`,
      );
    }
  }
}

/** Sends the requests of one collection: paging, batching, retries, and what gets logged. */
export default class DynamoExecutor {
  constructor(
    private readonly client: DynamoDBDocumentClient,
    private readonly model: TableModel,
    private readonly settings: CollectionSettings,
    private readonly logger: Logger,
  ) {}

  get maxScannedItems(): number {
    return this.model.maxScannedItems ?? this.settings.maxScannedItems;
  }

  newBudget(): ReadBudget {
    return new ReadBudget(this.model.tableName, this.maxScannedItems);
  }

  async *readPages(
    operation: ReadOperation,
    input: ReadInput,
    budget: ReadBudget = this.newBudget(),
  ): AsyncGenerator<Page> {
    let startKey = input.ExclusiveStartKey;

    this.logQuery(operation, input);

    do {
      if (budget.isAborted) return;

      const request = {
        TableName: this.model.tableName,
        ...input,
        ...this.capacityRequest(),
        ...(startKey ? { ExclusiveStartKey: startKey } : {}),
      };
      // eslint-disable-next-line no-await-in-loop
      const response = await this.client.send(
        operation === 'query' ? new QueryCommand(request) : new ScanCommand(request),
      );

      this.logCapacity(operation, response.ConsumedCapacity?.CapacityUnits);
      budget.charge(
        response.ScannedCount ?? response.Count ?? response.Items?.length ?? 0,
        operation,
      );
      startKey = response.LastEvaluatedKey;

      yield {
        items: (response.Items ?? []) as Item[],
        count: response.Count ?? response.Items?.length ?? 0,
        lastKey: startKey,
      };
    } while (startKey);
  }

  /** Reads items by key, 100 per request, asking again for the ones DynamoDB did not process. */
  async batchGet(
    keys: Item[],
    projection: Pick<ReadInput, 'ProjectionExpression' | 'ExpressionAttributeNames'> = {},
  ): Promise<Item[]> {
    const items: Item[] = [];
    const distinct = [...new Map(keys.map(key => [JSON.stringify(key), key])).values()];

    for (const keysChunk of chunk(distinct, BATCH_GET_SIZE)) {
      let pending: Item[] = keysChunk;

      for (let attempt = 0; pending.length > 0; attempt += 1) {
        if (attempt > 0) {
          // eslint-disable-next-line no-await-in-loop
          await this.backoff(attempt, pending.length);
        }

        // eslint-disable-next-line no-await-in-loop
        const response = await this.client.send(
          new BatchGetCommand({
            RequestItems: { [this.model.tableName]: { Keys: pending, ...projection } },
            ...this.capacityRequest(),
          }),
        );

        this.logBatchCapacity('batchGet', response.ConsumedCapacity);
        items.push(...((response.Responses?.[this.model.tableName] ?? []) as Item[]));
        pending = (response.UnprocessedKeys?.[this.model.tableName]?.Keys ?? []) as Item[];
      }
    }

    return items;
  }

  async batchDelete(keys: Item[]): Promise<void> {
    const distinct = [...new Map(keys.map(key => [JSON.stringify(key), key])).values()];

    await mapUntilSettled(chunk(distinct, BATCH_WRITE_SIZE), WRITE_CONCURRENCY, async keysChunk => {
      let pending = keysChunk.map(Key => ({ DeleteRequest: { Key } }));

      for (let attempt = 0; pending.length > 0; attempt += 1) {
        if (attempt > 0) {
          // eslint-disable-next-line no-await-in-loop
          await this.backoff(attempt, pending.length);
        }

        // eslint-disable-next-line no-await-in-loop
        const response = await this.client.send(
          new BatchWriteCommand({
            RequestItems: { [this.model.tableName]: pending },
            ...this.capacityRequest(),
          }),
        );

        this.logBatchCapacity('batchDelete', response.ConsumedCapacity);
        pending = (response.UnprocessedItems?.[this.model.tableName] ?? []) as typeof pending;
      }
    });
  }

  async mapWrites<T, R>(items: T[], handler: (item: T) => Promise<R>): Promise<R[]> {
    return mapUntilSettled(items, WRITE_CONCURRENCY, handler);
  }

  async put(input: Item): Promise<void> {
    const response = await this.client.send(
      new PutCommand({
        TableName: this.model.tableName,
        ...input,
        ...this.capacityRequest(),
      } as never),
    );
    this.logCapacity('put', response.ConsumedCapacity?.CapacityUnits);
  }

  async update(input: Item): Promise<Item | undefined> {
    const response = await this.client.send(
      new UpdateCommand({
        TableName: this.model.tableName,
        ...input,
        ...this.capacityRequest(),
      } as never),
    );
    this.logCapacity('update', response.ConsumedCapacity?.CapacityUnits);

    return response.Attributes;
  }

  async get(key: Item): Promise<Item | undefined> {
    const response = await this.client.send(
      new GetCommand({ TableName: this.model.tableName, Key: key, ...this.capacityRequest() }),
    );
    this.logCapacity('get', response.ConsumedCapacity?.CapacityUnits);

    return response.Item;
  }

  /** The item count DynamoDB keeps for the table, refreshed about every six hours. */
  async describeItemCount(): Promise<number> {
    const { Table: table } = await this.client.send(
      new DescribeTableCommand({ TableName: this.model.tableName }),
    );

    return table.ItemCount ?? 0;
  }

  private async backoff(attempt: number, unprocessed: number): Promise<void> {
    if (attempt > this.settings.maxWriteRetries) {
      throw new DynamoDBOperationError(
        `${unprocessed} item(s) are still unprocessed after ${this.settings.maxWriteRetries} retries`,
        undefined,
      );
    }

    await sleep(this.settings.writeRetryBaseDelayMs * 2 ** (attempt - 1));
  }

  private capacityRequest(): { ReturnConsumedCapacity?: 'TOTAL' } {
    return this.settings.logConsumedCapacity ? { ReturnConsumedCapacity: 'TOTAL' } : {};
  }

  private logBatchCapacity(operation: string, consumed?: Array<{ CapacityUnits?: number }>): void {
    const units = consumed?.reduce((sum, entry) => sum + (entry.CapacityUnits ?? 0), 0);

    if (units !== undefined) this.logCapacity(operation, units);
  }

  private logCapacity(operation: string, units?: number): void {
    if (this.settings.logConsumedCapacity && units !== undefined) {
      this.logger('Info', `[DynamoDB Capacity] ${this.model.name}.${operation}: ${units} units`);
    }
  }

  private logQuery(operation: ReadOperation, input: ReadInput): void {
    if (!this.settings.logQueries) return;

    this.logger(
      'Info',
      `[DynamoDB Query] ${this.model.name}.${operation}: ` +
        `KeyCondition=${input.KeyConditionExpression ?? '-'} | ` +
        `Filter=${input.FilterExpression ?? '-'} | Index=${input.IndexName ?? 'table'}`,
    );
  }
}
