In order to connect to different backends, Forest Admin abstracts away their differences.

Each one of the availables data sources "speaks" the language of the API it is targeting from one side, and exposes the Forest Admin Query Interface on the other one.

This API is by far _not_ a full featured ORM: its objective is too be "just enough" to fuel Forest Admin.

Writing an abstraction layer is full of compromises: small enough so that it can be written on top of APIs which may not be very capable but large enough so that all Forest Admin features can be implemented on top of them.

# When to use?

When customizing your forest admin with custom code (creating new actions, fields, ...), you can either access your data using the Forest Admin Query Interface, or using the native driver. It makes no difference for the admin panel.

| -                        | Forest Admin Query Interface              | Native Driver                          |
| ------------------------ | ----------------------------------------- | -------------------------------------- |
| Learning curve           | Use the same query interface for any SaaS | Different API for each database / SaaS |
| Differentiating features | Can make cross data-source requests       | Use all features of the underlying API |

# Example

This example shows the same segment implemented using both methods.

Using the forest admin query interface

```javascript
collection.addSegment('mySegment', async (context) => {
  const rows = await context.dataSource
    .getCollection('orders')
    .aggregate({}, { operation: 'Count', groups: [{ field: 'product_id' }] }, 10);

  return { field: 'id', operator: 'in', value: rows.map(r => r['product_id']) };
});
```

Using a native driver

```javascript
const client = new Client({ host: 'localhost', database: 'myDb', port: 5432 });
client.connect();

collection.addSegment('mySegment',  async (context) => {
  const { rows } = await client.query(`
    SELECT product_id, COUNT(*)
    FROM orders
    GROUP BY product_id
    ORDER BY count DESC
    LIMIT 10;
  `);

  return { field: 'id', operator: 'in', value: rows.map(r => r['product_id']) };
});
```

# Interface

More detail about those methods can be found in the [API Reference](https://github.com/ForestAdmin/agent-nodejs/wiki/@forestadmin.datasource-toolkit.Collection)

All parameters are explained in depth in the following pages:

- [Fields and projections](./fields-projections.md)
- [Filters](./filters.md)
- [Aggregations](./aggregations.md)

```typescript
interface DataSource {
  /** Retrieve list of all collection within the data source */
  get collections(): Collection[];

  /** Get collection by name */
  getCollection(name: string): Collection;
}

interface Collection {
  /** The schema contains the structure and capabilities of the collection */
  get schema(): CollectionSchema;

  /** Create new records */
  create(data: RecordData[]): Promise<RecordData[]>;

  /** List records matching filter */
  list(filter: PaginatedFilter, projection: Projection): Promise<RecordData[]>;

  /** Update records matching filter */
  update(filter: Filter, patch: RecordData): Promise<void>;

  /** Delete records matching filter */
  delete(filter: Filter): Promise<void>;

  /** Compute aggregated version of records matching filter */
  aggregate(filter: Filter, aggregation: Aggregation, limit?: number): Promise<AggregateResult[]>;
}
```
