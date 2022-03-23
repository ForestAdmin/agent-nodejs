After doing the quickstart, you should have a development project which is up and running and connected to your main data storage system.

Now, that's already useful and can be built upon, but what if you want your panel to display and act on:

- `Stripe` payments?
- `Intercom` conversations?
- Customer data that your sales team track in `Google Spreadsheet`?

Forest Admin has you covered: if your application depends on multiple SaaS providers, so should your admin panel.

Connectors are independent `NPM` packages which can be loaded into your `agent` to import collections into your admin panel.

# Usage

## Example

Forest Admin collection map to any of those concepts:

- Database collections/tables
- ORM collections
- Endpoints on supported SaaS providers
- Endpoints on your own API (by writing a custom connector)

Importing collection from new data sources is as simple as using the `importCollections` method on the main `Agent` instance.

```javascript
const SqlConnector = require('@forestadmin/connector-sql');
const StripeConnector = require('@forestadmin/connector-stripe');
const IntercomConnector = require('@forestadmin/connector-intercom');

const agent = new Agent(options);

// Create a Forest Admin collection ...
agent
  // ... for all table in a database
  .importCollections(new SqlConnector('postgres://user:pass@localhost:5432/mySchema'))

  // ... for a couple of stripe endpoints (charges & customers)
  .importCollections(new StripeConnector({ apiKey: 'sk_test_VePHdqKTYQjKNInc7u56JBrQ' }), {
    // restrict what gets imported
    actions: [], // Do not import any action
    collections: ['charges', 'customers'], // Import only 'charges' and 'customers'
    segments: ['charges.*'], // Import only segments of the 'charges' collection

    // rename customers (to avoid naming collision)
    rename: { customers: 'stripeCustomer' },
  })

  // ... for all intercom endpoints (companies, contacts, visitors, ...)
  .importCollections(new IntercomConnector({ accessToken: 'TmljZSB0cnkgOik=' }), {
    // import all collections besides visitors
    collections: ['!visitors'],

    // renaming can also done with a function
    rename: name => `intercom${name[0].toUpperCase()}${name.substring(1)}`,
  });
```

## Naming conflicts

When adding many datasources to an admin panel, it is easy to encounter naming collisions.

You can tackle them by either only adding the collections that you need, or by renaming some collections.

Don't worry if you leave naming collisions, your development agent will warn you while starting.

## Native actions and segments

Depending on the data source, collections imported from connectors may already implement `native actions` and `native segments`.
