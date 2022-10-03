After doing the quickstart, you should have a development project which is up and running and connected to your main data storage system.

Now, that's already useful and can be built upon, but what if you want your panel to display and act on:

- `Stripe` payments?
- `Intercom` conversations?
- Customer data that your sales team track in `Google Spreadsheet`?

Forest Admin has you covered. If your application depends on multiple SaaS providers, so should your admin panel: you can plug as many data sources as you want into the same agent.

## What can I connect to?

Forest Admin collections map to any of those concepts:

- Database collections/tables
- ORM collections
- Endpoints on SaaS providers
- Endpoints on your own API (by writing a custom data source)

## Example

In this example, we import tables from a PostgreSQL, MariaDB and Mongo database into Forest Admin.

```javascript
const { createAgent } = require('@forestadmin/agent');
const { createSqlDataSource } = require('@forestadmin/datasource-sql');
const { createMongooseDataSource } = require('@forestadmin/datasource-mongoose');

// Plug multiple datasources to a single agent.
const agent = createAgent(options)
  .addDataSource(createSqlDataSource('postgres://user:pass@a.server:5432/mySchema'))
  .addDataSource(createSqlDataSource('mariadb://user:pass@another.server:5432/anotherSchema'))
  .addDataSource(createMongooseDataSource(require('./mongoose-models')));
```
