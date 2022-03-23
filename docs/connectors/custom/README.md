Your admin panel is up and running. It's connected to your main data storage system and some of the SaaS that your company is using, but something is missing.

Custom connectors are the answer to the need to import collections from either unsupported databases, unsupported SaaS providers, or simply to your own in-house APIs.

Creating a custom connector is a three steps process:

- Declaring the structure of the data

  - Which collections are present?
  - What fields to they contain?
  - What are their types?
  - Are some collections related to others? Where are the foreign keys?

- Declaring the API capabilities

  - Can records be listed?
    - Is the output filterable? On which fields? With which operators?
    - Is the output sortable? On which fields?
    - Do we need to fetch all fields on each request? Or can we query partial records?
    - Can the underlying data source load relations?
  - Can records be created?
  - Can records be updated?
  - Can records be deleted?
  - Can records be aggregated? (for charts / counting)

- Coding a translation layer between how queries are expressed in Forest Admin API versus the target API

# Tooling

In order to make your journey easier, a `npm` package which contains tooling is provided: [npmjs://@forestadmin/connector-toolkit](https://www.npmjs.com/package/@forestadmin/connector-toolkit)

It contains:

- All interfaces that you'll be either using or implementing while making your connector
- Aggregation, filtering, projection and sorting emulators which can be called from inside your collection
  - This is a perfect match during development
  - It allows to be up and running with all features in minutes (with low performance)
  - You can then translate forest admin concepts one by one, and improve performance gradually
- Decorators which can be loaded on top of your collections to add new behaviors
  - This is a good match to implement features which are not natively supported by the target
  - It allows to bundle reusable behaviors in your connector, that would otherwise need to be added on the configuration of agents by using `customizeCollection`.

Take note that all connectors which are provided by Forest Admin were actually coded using this same toolkit, so you'll be using the same tools as we are.

# A quick peek at code

A collection in Forest Admin can be anything as long as it implements the contract which is defined by the `BaseCollection` abstract class.

{% tabs %} {% tab title="Creating a single collection connector" %}

```javascript
const { BaseCollection, FieldTypes, PrimitiveTypes } = require('@forestadmin/connector-toolkit');
const MyApiClient = require('my-api-client'); // client for the target API

// The real work is in writing this module
const QueryGenerator = require('./forest-query-translation');

/** Minimal implementation of a readonly connector */
class MyCollection extends BaseCollection {
  constructor() {
    // Set name of the collection once imported
    super('myCollection');

    // Add a single field to the collection
    this.addField('id', {
      // Structure
      type: FieldsType.Column,
      columnType: PrimitiveType.Number,
      isPrimaryKey: true,

      // Capabilities
      isReadOnly: true, // field is readonly
      filterOperators: new Set(), // field is not filterable
      isSortable: false, // field is not sortable
    });
  }

  /**
   * List data (used by forest admin to fetch records)
   * - filter: which records are wanted?
   * - projection: which fields are wanted in the records?
   */
  async list(filter, projection) {
    return MyApiClient.query(QueryGenerator.translateList(filter, projection));
  }

  /**
   * Aggregate records (used by forest admin to count records, and generate charts)
   * - filter: which records are wanted?
   * - aggregation: how should records be aggregated?
   * - limit: how many rows?
   */
  async aggregate(filter, aggregation, limit) {
    return MyApiClient.query(QueryGenerator.translateAggregate(filter, aggregation, limit));
  }
}

module.exports = MyCollection;
```

{% endtab %} {% tab title="Using the connector" %}

```javascript
const MyConnectorCollection = require('./');

const agent = new Agent(options);
agent
  // import the collection we just defined
  .importCollection(new MyConnectorCollection())

  // We can now customize it like any other collection
  .customizeCollection('myCollection', collection =>
    collection
      .registerField('aNewField', { ... })
      .registerSegment('aNewSegment', { ... })
  );
```

{% endtab %} {% endtabs %}
