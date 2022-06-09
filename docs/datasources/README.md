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
- Endpoints on supported SaaS providers
- Endpoints on your own API (by writing a custom data source)

## Example

In this example, we import a all tables from a PostgreSQL database into Forest Admin.

Take note that data sources are defined in independent NPM packages (here `@forestadmin/datasource-sql`).

```javascript
const { createAgent } = require('@forestadmin/agent');
const { createSqlDataSource } = require('@forestadmin/datasource-sql');

const agent = createAgent(options).addDataSource(
  createSqlDataSource('postgres://user:pass@localhost:5432/mySchema'),
);
```

## Naming conflicts

When importing collections to an admin panel, you may encounter naming collisions.

You can tackle them by renaming the collection which are causing issues.

Don't worry if you leave naming collisions, your development agent will warn you while starting.

```javascript
const { createAgent } = require('@forestadmin/agent');
const { createSqlDataSource } = require('@forestadmin/datasource-sql');

const agent = createAgent(options);
const sqlDataSource = new createSqlDataSource('postgres://user:pass@localhost:5432/mySchema');

// Rename sqlDataSource collections by providing replacements
agent.addDataSource(sqlDataSource, {
  rename: {
    customers: 'superCustomers',
  },
});
```

<!--
## Partial imports

Some data source may implement more collections, and associated actions and segments that you want.

By provided options when plugin a data source, you can specify which entities should get loaded.

```javascript
const { createAgent } = require('@forestadmin/agent');
const StripeDataSource = require('@forestadmin/datasource-stripe');

const agent = createAgent(options);
const stripe = new StripeDataSource({ apiKey: 'sk_test_VePHdqKTYQjKNInc7u56JBrQ' });

agent.addDataSource(stripe, {
  restrict: {
    // Skip 'visitors' collections
    collections: ['!visitors'],

    // Do not import any action
    actions: [],

    // Import all fields (this is the default)
    fields: ['users.*', 'books.id', 'books.title'],

    // Import only segments of the 'charges' collection
    segments: ['charges.*'],
  },
});
```
-->
