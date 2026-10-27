# @forestadmin/datasource-dynamodb

Forest Admin datasource for Amazon DynamoDB: introspection (live, saved or written by hand), composite keys,
relations, search, aggregations and charts, single-table design.

```bash
yarn add @forestadmin/datasource-dynamodb
```

```ts
import { createAgent } from '@forestadmin/agent';
import { createDynamoDBDataSource } from '@forestadmin/datasource-dynamodb';

createAgent({ authSecret, envSecret, isProduction })
  // Every table of the account and region, introspected
  .addDataSource(createDynamoDBDataSource({ region: 'eu-west-1' }));
```

Credentials come from the usual AWS chain (environment, profile, role). Pass `credentials`,
`endpoint` (DynamoDB Local) or `clientConfig` to override them, or `client` to reuse a
`DynamoDBClient` or `DynamoDBDocumentClient` you already have.

## Why DynamoDB is not like the other datasources

DynamoDB reads fast by key and scans otherwise, and it cannot sort, count or aggregate on the
server. The datasource uses the key whenever a filter allows it and does the rest on the items it
reads. What that means for each feature:

| Feature          | How it works                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Filters          | Pushed down when DynamoDB can evaluate them. `Like`, `ILike`, `IContains`, `EndsWith`, date intervals and the like are applied on the returned items, so they read more than they return.                                                                                                                                                                                                                                                        |
| Access path      | A `Query` on the table, a global or local secondary index when an equality pins its partition key (with the sort key range when there is one), a `BatchGetItem` when the filter names whole keys, a `Scan` otherwise. An index leaves out the items that lack its sort key, so one that has a sort key is only read when the filter has a condition on that key, or when the index is declared with `coversAllItems: true` in the introspection. |
| Sort             | Free on the sort key of the table or index being read. On any other attribute, the matching items are read, then sorted in memory.                                                                                                                                                                                                                                                                                                               |
| Pagination       | There is no offset: the datasource remembers the key where earlier pages stopped and resumes from the closest one. `maxOffset` (100 000) caps how deep a page can be.                                                                                                                                                                                                                                                                            |
| Count and charts | Computed by reading the items (a counting `Scan`/`Query` for a plain count), in parallel segments for a table. Results are kept in memory for `chartCacheTtlMs` (30 s).                                                                                                                                                                                                                                                                          |
| Search           | Evaluated on the items: it scans. Case-insensitive, accents kept.                                                                                                                                                                                                                                                                                                                                                                                |
| Relations        | None in DynamoDB. Declare them with `addManyToOneRelation` and friends: a lookup by key is one `BatchGetItem`, a relation backed by a secondary index is a `Query`.                                                                                                                                                                                                                                                                              |

## Controlling cost: `scanPolicy`

A request that no key or index serves reads the whole table. `scanPolicy` decides what happens:

| Value              | Behaviour                                                                            |
| ------------------ | ------------------------------------------------------------------------------------ |
| `'warn'` (default) | Scans and logs a warning naming the table and the filtered fields, never the values. |
| `'allow'`          | Scans silently.                                                                      |
| `'deny'`           | Refuses with an explicit error.                                                      |

Any other value is refused at startup.

`maxScannedItems` (1 000 000) stops any single request that reads more items than that, with an error
rather than a partial result. PartiQL native queries do not report how many items they evaluated,
so for them it bounds the rows returned, and the pages fetched are capped at 1000. Both can be set on the datasource or on a collection.

## Choosing the tables and adjusting collections

`tables: ['Customers', 'Orders']` only introspects the listed tables, and names each collection
after its table.

The builder adjusts collections one table at a time: to name them, to tune them, or to share a table
between several collections. The tables it names are not introspected a second time, and the other
tables are still introspected as usual:

```ts
createDynamoDBDataSource({
  region: 'eu-west-1',
  builder: configurator =>
    configurator
      .addCollectionFromTable({
        name: 'users',
        tableName: 'App',
        entity: { sortKeyPrefix: 'USER#' },
      })
      .addCollectionFromTable({
        name: 'orders',
        tableName: 'App',
        entity: { sortKeyPrefix: 'ORDER#' },
      }),
});
```

Here `App` becomes two collections and every other table keeps its own. Add `tables: []` to expose
the builder collections only.

## Introspection

`DescribeTable` gives the keys and the indexes. The other attributes are typed from a sample of
`sampleSize` items (default 100): DynamoDB does not type them. A scan has no order, so the sample is
not the latest items. Nested maps become `address@@@city` columns up to `maxDepth` (5); an attribute
that is absent or null in part of the sample is nullable; mixed types become Json.

## Saving the introspection, or writing it by hand

`introspect` samples the tables and describes them as collection definitions. Save the result and
give it back as the `introspection` of the datasource: the agent then starts without calling
`DescribeTable` or sampling the tables.

```ts
import { createDynamoDBDataSource, introspect } from '@forestadmin/datasource-dynamodb';

// Once, from a script
const introspection = await introspect({ region: 'eu-west-1' });
await fs.promises.writeFile('introspection.json', JSON.stringify(introspection, null, 2));

// At startup
createDynamoDBDataSource(
  { region: 'eu-west-1' },
  { introspection: JSON.parse(await fs.promises.readFile('introspection.json', 'utf8')) },
);
```

The file is plain JSON, so it can be edited: add what the sampling cannot know (a nullable
attribute, an index that `coversAllItems`, a set), or write the whole of it by hand. An
`introspection` cannot be combined with a `builder`.

```ts
createDynamoDBDataSource(
  { region: 'eu-west-1' },
  {
    introspection: {
      version: 1,
      collections: [
        {
          name: 'orders',
          tableName: 'Orders',
          partitionKey: { name: 'customerId', type: 'string' },
          sortKey: { name: 'orderId', type: 'string' },
          indexes: [
            {
              name: 'by-status',
              type: 'GSI',
              partitionKey: { name: 'status', type: 'string' },
              sortKey: { name: 'createdAt', type: 'string' },
            },
          ],
          fields: [
            { name: 'total', type: 'number' },
            { name: 'status', type: 'string', nullable: true },
            { name: 'address', type: 'object', fields: [{ name: 'city', type: 'string' }] },
          ],
        },
      ],
    },
  },
);
```

Nested maps are columns named with `@@@` (`address@@@city`), which Forest shows as a path.

Dates are compared by their instant when sorted or aggregated here, but DynamoDB orders and compares
them as text on a key and when it filters: store them in one offset (UTC) if a date is a sort key or
you filter on ranges of it.

Types: `string`, `number`, `boolean`, `date` and `dateonly` (ISO 8601 strings), `timeonly`, `object`,
`array`, `point` (GeoJSON, exposed as Json), `binary` (base64, filtered on the returned items). Keys
are strings or numbers. `timeonly` is exposed as Forest's `Time`. A number beyond 2^53 is read as
text, to keep every digit. A string or number set is read as an array and written back as a set when
the introspection saw it as one, or when the introspection declares `set: true` on the array.

## Composite keys

The partition key and the sort key are both primary key columns of the collection, so Forest
identifies a record by the two. A record created without a string partition or sort key gets a UUID (the sort key keeps its
entity prefix, when there is one), since Forest greys the key fields of the creation form. A
numeric key has to be supplied.
Keys cannot be updated.

## Single-table design

Several collections can share a table, each restricted to its items:

```ts
configurator
  .addCollectionFromTable({
    name: 'users',
    tableName: 'App',
    entity: { sortKeyPrefix: 'USER#' }, // or { attribute: 'entityType', value: 'USER' }
  })
  .addCollectionFromTable({
    name: 'orders',
    tableName: 'App',
    entity: { sortKeyPrefix: 'ORDER#' },
  });
```

A sort key prefix is also used as the sort key condition of queries, and checked on create.

## Arrays as collections

`virtualArrayCollections`, the name the Cosmos DB datasource uses, is read as an alias of
`virtualCollections`.

```ts
createDynamoDBDataSource({
  virtualCollections: [
    { parentCollection: 'orders', collectionName: 'order_lines', arrayField: 'lines' },
  ],
});
```

Each element of the array becomes a record, identified by the key of the table item and its `index`
in the array. Creating appends, updating sets the element's attributes, and deleting removes it, so
the index of the following elements shifts.

`arrayField` can point inside a map (`'meta@@@items'`). An array of an array is a collection whose
parent is the first one, declared after it: the position in the outer array becomes a key column
named `<parent>Index`, and creating an inner element needs it.

```ts
virtualCollections: [
  { parentCollection: 'orders', collectionName: 'order_lines', arrayField: 'lines' },
  { parentCollection: 'order_lines', collectionName: 'line_parts', arrayField: 'parts' },
];
```

## Native queries

`liveQueryConnection: 'dynamo'` offers PartiQL `SELECT` statements as native queries, with `$name`
placeholders: `SELECT * FROM "Orders" WHERE customerId = $customer`. PartiQL cannot aggregate, so
charts are built with the collection's aggregations instead.

## Observability

`logQueries` logs the expressions sent to DynamoDB, `logConsumedCapacity` the capacity units each
request consumed. Throttled requests are retried by the AWS SDK (`adaptive`, 10 attempts).

## Not supported yet

Collections backed by a secondary index, optimistic updates, binary keys, exact counts without
reading the items.

## Testing

```bash
docker compose up -d
DYNAMODB_ENDPOINT=http://localhost:8000 yarn test
```

Without `DYNAMODB_ENDPOINT` the integration suite against DynamoDB Local is skipped.
