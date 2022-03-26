After doing the quickstart, you should have a development project which is up and running and connected to your main data storage system.

Now, that's already useful and can be built upon, but what if you want your panel to display and act on:

- `Stripe` payments?
- `Intercom` conversations?
- Customer data that your sales team track in `Google Spreadsheet`?

Forest Admin has you covered: if your application depends on multiple SaaS providers, so should your admin panel.

# What can I connect to?

Forest Admin collection map to any of those concepts:

- Database collections/tables
- ORM collections
- Endpoints on supported SaaS providers
- Endpoints on your own API (by writing a custom connector)

## Example

In this example, we import a all tables from a PostgreSQL database into Forest Admin.

Take note that connectors are defined in independant NPM packages (here `@forestadmin/connector-sql`).

```javascript
const Agent = require('@forestadmin/agent');
const SqlConnector = require('@forestadmin/connector-sql');

const agent = new Agent(options);
const database = new SqlConnector('postgres://user:pass@localhost:5432/mySchema');

agent.importCollectionsFrom(database);
```

## Partial imports

Some connector may implement more collections, and associated actions and segments that you want.

By provided options when pluging a connector, you can specify what you want to include into

```javascript
const Agent = require('@forestadmin/agent');
const StripeConnector = require('@forestadmin/connector-stripe');
const IntercomConnector = require('@forestadmin/connector-intercom');

const agent = new Agent(options);
const stripe = new StripeConnector({ apiKey: 'sk_test_VePHdqKTYQjKNInc7u56JBrQ' });
const intercom = new IntercomConnector({ accessToken: 'TmljZSB0cnkgOik=' });

agent.importCollectionsFrom(stripe, {
  restrict: {
    // Skip 'visitors' collections
    collections: ['!visitors'],

    // Do not import any action
    actions: [],

    // Import all fields (this is the default)
    fields: ['*'],

    // Import only segments of the 'charges' collection
    segments: ['charges.*'],
  },
});
```

## Naming conflicts

When importing collections to an admin panel, it is easy to encounter naming collisions.

You can tackle them by either only adding the collections that you need, or by renaming some collections.

Don't worry if you leave naming collisions, your development agent will warn you while starting.

```javascript
const Agent = require('@forestadmin/agent');
const StripeConnector = require('@forestadmin/connector-stripe');
const IntercomConnector = require('@forestadmin/connector-intercom');

const agent = new Agent(options);
const stripe = new StripeConnector({ apiKey: 'sk_test_VePHdqKTYQjKNInc7u56JBrQ' });
const intercom = new IntercomConnector({ accessToken: 'TmljZSB0cnkgOik=' });

// Rename stripe collections by providing replacements
agent.importCollectionsFrom(stripe, {
  rename: {
    customers: 'stripeCustomer',
  },
});

// Rename intercom collections with a function
agent.importCollectionsFrom(intercom, {
  rename: name => `intercom${name[0].toUpperCase()}${name.substring(1)}`,
});
```

<!--

# Tooling

In order to make your journey easier, a `npm` package which contains tooling is provided: [npmjs://@forestadmin/connector-toolkit](https://www.npmjs.com/package/@forestadmin/connector-toolkit)

It contains:

- All interfaces that you'll be either using or implementing while making your connector
- An implementation of a caching connector, which implements all forest admin features.
- Aggregation, filtering, projection and sorting emulators which can be called from inside your collection
  - This is a perfect match during development
  - It allows to be up and running with all features in minutes (with low performance)
  - You can then translate forest admin concepts one by one, and improve performance gradually
- Decorators which can be loaded on top of your collections to add new behaviors
  - This is a good match to implement features which are not natively supported by the target
  - It allows to bundle reusable behaviors in your connector, that would otherwise need to be added on the configuration of agents by using `customizeCollection`.

Take note that all connectors which are provided by Forest Admin were actually coded using this same toolkit, so you'll be using the same tools as we are. -->
