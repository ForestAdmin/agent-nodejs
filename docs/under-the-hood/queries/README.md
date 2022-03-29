In order to connect to many different backends, Forest Admin needs to abstract away their differences.

Each one of the availables connectors "speaks" the language of the API it is targeting from one side, and exposes the Forest Admin Query Interface on the other one.

This API is by far _not_ a full featured ORM: its objective is too be "just enough" to fuel Forest Admin.

Writing an abstraction layer is full of compromises: small enough so that it can be written on top of APIs which may not be very capable but large enough so that all Forest Admin features can be implemented on top of them.

# When to use?

When customizing your forest admin with custom code (creating new actions, fields, ...), you can either access your data using the Forest Admin Query Interface, or using the native driver. It makes no difference for the admin panel.

Using the forest admin query interface

```javascript
collection.registerSegment('mySegment', context => {
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

collection.registerSegment('mySegment', context => {
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

Which one should you use?

| -                        | Forest Admin Query Interface              | Native Driver                          |
| ------------------------ | ----------------------------------------- | -------------------------------------- |
| Capabilities             | Less capable                              | More capable                           |
| Learning curve           | Use the same query interface for any SaaS | Different API for each database / SaaS |
| Differentiating features | Can make cross-connector requests         | Use all features of the underlying API |

# Examples

```javascript
const { SqlDataSource } = require('@forestadmin/datasource-sql');

const datasource = new SqlDataSource('postgres://localhost:5432/myDb');
const books = datasource.getCollection('books');

const lastBooks = await books.list(
  {
    sort: [{ field: 'createdAt', ascending: false }],
    page: { skip: 0, limit: 2 },
  },
  ['id', 'title', 'author:name'],
);
// => [
//   { id: 1, title: 'Foudation', author: { name: 'Asimov' } }
//   { id: 2, title: 'Beat the dealer', author: { name: 'Thorp' } }
// ]

const numBooks = await books.aggregate({}, { operation: 'Count' });
// => 45

const avgRatingByAuthor = await books.aggregate(
  {
    conditionTree: { field: 'createdAt', operator: 'less_than', value: '2010-01-01' },
  },
  {
    operation: 'Average',
    field: 'rating',
    groups: [{ field: 'author:name' }],
  },
  3,
);
// => [
//   { rating: 23, group: { 'author:name': 'Asimov' } },
//   { rating: 33, group: { 'author:name': 'Thorp' } },
//   { rating: 44, group: { 'author:name': 'Hugo' } }
// ]
```

# Datasour

## Listing records

```javascript

```
