After doing the quickstart, you should have a development project which is up and running and connected to your main data storage system.

Now, that's already useful and can be built upon, but what if you want your panel to display and act on:

- `Stripe` payments?
- `Intercom` conversations?
- Customer data that your sales team track in `Google Spreadsheet`?

Forest Admin has you covered: if your application depends on multiple SaaS providers, so should your admin panel.

## What can I connect to?

Forest Admin collections map to any of those concepts:

- Database collections/tables
- ORM collections
- Endpoints on SaaS providers
- Endpoints on your own API (by writing a custom data source)

## Example

In this example, we import all tables from a PostgreSQL database into Forest Admin.

Take note that data sources are defined in independent NPM packages (here `@forestadmin/datasource-sql`).

```javascript
const { createAgent } = require('@forestadmin/agent');
const { createSqlDataSource } = require('@forestadmin/datasource-sql');

const agent = createAgent(options).addDataSource(
  createSqlDataSource('postgres://user:pass@localhost:5432/mySchema'),
);
```
