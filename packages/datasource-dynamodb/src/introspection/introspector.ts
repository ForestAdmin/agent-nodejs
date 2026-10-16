import type {
  AttributeSchema,
  DynamoDataType,
  EntityDefinition,
  IndexModel,
  KeyAttribute,
  OverrideTypeConverter,
  ScanPolicy,
  TableModel,
} from '../types';
import type { TableDescription } from '@aws-sdk/client-dynamodb';
import type { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { Logger } from '@forestadmin/datasource-toolkit';

import { DescribeTableCommand, ListTablesCommand } from '@aws-sdk/client-dynamodb';
import { ScanCommand } from '@aws-sdk/lib-dynamodb';
import { ValidationError } from '@forestadmin/datasource-toolkit';

import { mapWithConcurrency } from '../utils/concurrency';
import ExpressionBuilder from '../utils/expression-builder';
import { PATH_SEPARATOR } from '../utils/serializer';
import TypeConverter from '../utils/type-converter';

export const DEFAULT_SAMPLE_SIZE = 100;
export const DEFAULT_MAX_DEPTH = 5;
const INTROSPECTION_CONCURRENCY = 5;
/** A sample restricted to an entity can need several scans, as the limit counts unfiltered items. */
const MAX_SAMPLE_SCANS = 20;
const KEY_TYPE_FOR_ATTRIBUTE = { S: 'S', N: 'N' } as const;

export type TableIntrospectionOptions = {
  collectionName: string;
  tableName: string;
  sampleSize?: number;
  maxDepth?: number;
  entity?: EntityDefinition;
  enableCount?: boolean;
  scanPolicy?: ScanPolicy;
  maxScannedItems?: number;
  overrideTypeConverter?: OverrideTypeConverter;
};

type Item = Record<string, unknown>;

function toKeyAttribute(table: TableDescription, name: string): KeyAttribute {
  const attributeType = table.AttributeDefinitions?.find(
    definition => definition.AttributeName === name,
  )?.AttributeType;

  if (attributeType === 'B') {
    throw new ValidationError(
      `Key '${name}' of table '${table.TableName}' is binary, which is not supported`,
    );
  }

  return { name, type: KEY_TYPE_FOR_ATTRIBUTE[attributeType as 'S' | 'N'] ?? 'S' };
}

function keysOf(
  table: TableDescription,
  keySchema: TableDescription['KeySchema'],
): { partitionKey: KeyAttribute; sortKey?: KeyAttribute } {
  const partition = keySchema.find(key => key.KeyType === 'HASH');
  const sort = keySchema.find(key => key.KeyType === 'RANGE');

  return {
    partitionKey: toKeyAttribute(table, partition.AttributeName),
    sortKey: sort ? toKeyAttribute(table, sort.AttributeName) : undefined,
  };
}

function indexesOf(table: TableDescription): IndexModel[] {
  const describe = (
    indexes: TableDescription['GlobalSecondaryIndexes'],
    type: IndexModel['type'],
  ): IndexModel[] =>
    (indexes ?? []).map(index => ({
      name: index.IndexName,
      type,
      ...keysOf(table, index.KeySchema),
      projectsAllAttributes: index.Projection?.ProjectionType === 'ALL',
    }));

  return [
    ...describe(table.GlobalSecondaryIndexes, 'GSI'),
    ...describe(table.LocalSecondaryIndexes, 'LSI'),
  ];
}

/** Records the type of every attribute of an item, expanding nested maps up to `maxDepth`. */
function collectTypes(
  value: unknown,
  path: string,
  depth: number,
  maxDepth: number,
  types: Record<string, DynamoDataType[]>,
  presentInItem: Set<string>,
): void {
  const record = (type: DynamoDataType) => {
    types[path] ??= [];
    types[path].push(type);
    presentInItem.add(path);
  };

  const inferred = TypeConverter.inferTypeFromValue(value);

  if (inferred !== 'object') {
    if (path) record(inferred);

    return;
  }

  if (depth >= maxDepth) {
    record('object');

    return;
  }

  const entries = Object.entries(value as Item);

  if (entries.length === 0) record('object');

  for (const [key, nested] of entries) {
    collectTypes(
      nested,
      path ? `${path}${PATH_SEPARATOR}${key}` : key,
      depth + 1,
      maxDepth,
      types,
      presentInItem,
    );
  }
}

export function inferSchema(
  items: Item[],
  keys: KeyAttribute[],
  maxDepth: number,
): Record<string, AttributeSchema> {
  // Attribute names are data: `constructor` or `__proto__` must not reach Object.prototype.
  const types: Record<string, DynamoDataType[]> = Object.create(null);
  const presence: Record<string, number> = Object.create(null);

  for (const item of items) {
    const present = new Set<string>();
    collectTypes(item, '', 0, maxDepth, types, present);
    present.forEach(path => {
      presence[path] = (presence[path] ?? 0) + 1;
    });
  }

  const schema: Record<string, AttributeSchema> = Object.create(null);

  // A map seen empty or null in some items and populated in others was recorded as a value and
  // as nested attributes: only the nested ones are columns, the map itself is expanded.
  const paths = Object.keys(types);
  const hasNested = (path: string) =>
    paths.some(other => other.startsWith(`${path}${PATH_SEPARATOR}`));

  for (const [path, observed] of Object.entries(types).filter(([path]) => !hasNested(path))) {
    schema[path] = {
      type: TypeConverter.getMostSpecificType(observed),
      nullable: observed.includes('null') || presence[path] < items.length,
    };
  }

  for (const key of keys) {
    schema[key.name] = { type: key.type === 'N' ? 'number' : 'string', nullable: false };
  }

  return schema;
}

async function sampleItems(
  client: DynamoDBDocumentClient,
  table: TableDescription,
  sortKey: KeyAttribute | undefined,
  options: TableIntrospectionOptions,
): Promise<Item[]> {
  const sampleSize = options.sampleSize ?? DEFAULT_SAMPLE_SIZE;
  const { entity } = options;
  const builder = new ExpressionBuilder();
  let filter: string;

  if (entity?.sortKeyPrefix !== undefined) {
    filter = `begins_with(${builder.attribute(sortKey.name)}, ${builder.value(
      entity.sortKeyPrefix,
    )})`;
  } else if (entity?.attribute !== undefined) {
    filter = `${builder.attribute(entity.attribute)} = ${builder.value(entity.value)}`;
  }

  const items: Item[] = [];
  let startKey: Item;

  for (let scans = 0; scans < MAX_SAMPLE_SCANS && items.length < sampleSize; scans += 1) {
    // eslint-disable-next-line no-await-in-loop
    const response = await client.send(
      new ScanCommand({
        TableName: table.TableName,
        Limit: sampleSize,
        ...(filter ? { FilterExpression: filter, ...builder.result() } : {}),
        ...(startKey ? { ExclusiveStartKey: startKey } : {}),
      }),
    );

    items.push(...((response.Items ?? []) as Item[]));
    startKey = response.LastEvaluatedKey;

    if (!startKey) break;
  }

  return items.slice(0, sampleSize);
}

/** Reads the key schema and indexes of a table, and infers its attributes from a sample. */
export async function introspectTable(
  client: DynamoDBDocumentClient,
  options: TableIntrospectionOptions,
): Promise<TableModel> {
  const { Table: table } = await client.send(
    new DescribeTableCommand({ TableName: options.tableName }),
  );
  const { partitionKey, sortKey } = keysOf(table, table.KeySchema);

  if (options.entity?.sortKeyPrefix !== undefined && !sortKey) {
    throw new ValidationError(
      `Table '${options.tableName}' has no sort key, so 'sortKeyPrefix' cannot be used`,
    );
  }

  const items = await sampleItems(client, table, sortKey, options);

  return {
    name: options.collectionName,
    tableName: options.tableName,
    partitionKey,
    sortKey,
    indexes: indexesOf(table),
    schema: inferSchema(
      items,
      [partitionKey, sortKey].filter(Boolean),
      options.maxDepth ?? DEFAULT_MAX_DEPTH,
    ),
    entity: options.entity,
    enableCount: options.enableCount,
    scanPolicy: options.scanPolicy,
    maxScannedItems: options.maxScannedItems,
    overrideTypeConverter: options.overrideTypeConverter,
  };
}

async function listTables(client: DynamoDBDocumentClient): Promise<string[]> {
  const names: string[] = [];
  let startName: string;

  do {
    // eslint-disable-next-line no-await-in-loop
    const response = await client.send(
      new ListTablesCommand(startName ? { ExclusiveStartTableName: startName } : {}),
    );
    names.push(...(response.TableNames ?? []));
    startName = response.LastEvaluatedTableName;
  } while (startName);

  return names;
}

/** Introspects the given tables, or every table of the account and region. */
export async function introspectTables(
  client: DynamoDBDocumentClient,
  options: { tables?: string[]; sampleSize?: number; maxDepth?: number },
  logger: Logger,
): Promise<TableModel[]> {
  const tableNames = options.tables ?? (await listTables(client));

  const models = await mapWithConcurrency(
    tableNames,
    INTROSPECTION_CONCURRENCY,
    async tableName => {
      try {
        return await introspectTable(client, {
          collectionName: tableName,
          tableName,
          sampleSize: options.sampleSize,
          maxDepth: options.maxDepth,
        });
      } catch (error) {
        logger('Warn', `Introspector - Skipping table '${tableName}': ${error.message}`);

        return null;
      }
    },
  );

  return models.filter(Boolean);
}
