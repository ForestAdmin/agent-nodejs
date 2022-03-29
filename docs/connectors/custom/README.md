Custom connectors are the answer to the need to import collections from either

- Your own in-house APIs.
- Unsupported databases
- Unsupported SaaS providers

Forest Admin is built so that it does not know need the nature of the datasource it is speaking to, at long as it exposes a given interface.

That interface is only there to abstract away differences between backends so that they can be used as forest admin collections, it was built to allow for the minimal feature set which allow forest admin to work.

# Getting started

When creating a custom connector two strategies can be used:

| -                | Using a local cache                                                                          | Implement query translation                                                       |
| ---------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Recommended for  | SaaS and APIs                                                                                | Databases or APIs with advanced query capabilities                                |
| How does it work | All data is cached locally for read operations, write operations are forwarded to the target | The connector translates all forest admin queries to the target API on real time. |
| Preconditions    | Low: Target API can either sort or filter by last modification                               | High: Target API is capable of expressing filters, aggregating data, ...          |
| Pros             | Easy to implement and fast                                                                   | No disk usage and no limits on quantity of data                                   |
| Cons             | Slower agent start, Disk Usage, Quantity of data may be too large                            | More difficult to implement, and can be slow depending on target                  |

## Steps

Depending on your choice between "Local Cache" or "Query Translation", creating a connector is a very different task.

Local Cache:

1. Declaring the structure of the data
2. Implement a method which loads all records which changed since a provided date
3. When relevant, implement methods for record creation, update and delete

Query Translation:

1. Declaring the structure of the data
2. Declaring the API capabilities
3. Coding a translation layer

## Minimal example

{% tabs %} {% tab title="Connector: Using a local cache" %}

```javascript
const { CachedCollection, PrimitiveTypes } = require('@forestadmin/datasource-toolkit');
const axios = require('my-api-client'); // client for the target API

class MyCollection extends CachedCollection {
  constructor(dataSource) {
    // Set name of the collection once imported
    super('myCollection', dataSource);

    // Add fields
    this.addField('id', {
      // Structure
      columnType: PrimitiveType.Number,
      isPrimaryKey: true,

      // Capabilities (no need for filterOperators or isSortable in the local-cache strategy)
      isReadOnly: true,
    });

    this.addField('title', {
      columnType: PrimitiveType.String,
    });
  }

  /**
   * You are free to tune this generator as you see fit, depending on the capabilities and
   * performance of the API that you are targeting.
   *
   * It should yield records updated since `lastThreshold` in any order, and return the new
   * threshold
   */
  async *listChangedRecords(lastThreshold) {
    const response = await axios.get(`https://my-api/my-collection`, {
      params: { filter: `updatedAt > '${lastThreshold}'` },
    });

    yield response.body.items;

    return new Date().toISOString();
  }
}

class MyDataSource extends CachedDataSource {
  constructor() {
    super(
      'sqlite::memory:', // Cache data in memory (avoid in production)
      [new MyCollection(this)], // List of your collections
    );
  }
}

module.exports = MyDataSource;
```

{% endtab %} {% tab title="Connector: Using query translation" %}

```javascript
const { BaseCollection, PrimitiveTypes } = require('@forestadmin/datasource-toolkit');
const axios = require('axios'); // client for the target API

// The real work is in writing this module
// Expect a full featured query translation module to be over 1000 LOCs
const QueryGenerator = require('./forest-query-translation');

/** Minimal implementation of a readonly connector */
class MyCollection extends BaseCollection {
  constructor() {
    // Set name of the collection once imported
    super('myCollection');

    // As we are using the query translation technique, we need to define capabilities for every field
    this.addField('id', {
      // Structure
      columnType: PrimitiveType.Number,
      isPrimaryKey: true,

      // Capabilities
      isReadOnly: true, // field is readonly
      filterOperators: new Set(), // field is not filterable
      isSortable: false, // field is not sortable
    });

    this.addField('title', {
      columnType: PrimitiveType.String,
      isReadOnly: true,
      filterOperators: new Set(),
      isSortable: false,
    });
  }

  /**
   * List data (used by forest admin to fetch records)
   * - filter: which records are wanted?
   * - projection: which fields are wanted in the records?
   */
  async list(filter, projection) {
    const params = QueryGenerator.generateListQueryString(filter, projection);
    const response = axios.get('https://my-api/my-collection', { params });

    return response.body.items;
  }

  /**
   * Aggregate records (used by forest admin to count records, and generate charts)
   * - filter: which records are wanted?
   * - aggregation: how should records be aggregated?
   * - limit: how many rows?
   */
  async aggregate(filter, aggregation, limit) {
    const params = QueryGenerator.generateAggregateQueryString(filter, projection);
    const response = axios.get('https://my-api/my-collection', { params });

    return response.body.items;
  }
}

class MyDataSource extends BaseDataSource {
  constructor() {
    super(
      [new MyCollection(this)], // List of your collections
    );
  }
}

module.exports = MyDataSource;
```

{% endtab %} {% tab title="Agent: Using the connector" %}

```javascript
const MyDataSource = require('./connector');

const agent = new Agent(options);

agent.addDatasource(new MyDataSource());
```

{% endtab %} {% endtabs %}
