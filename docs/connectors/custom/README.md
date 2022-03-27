Custom connectors are the answer to the need to import collections from either

- Unsupported databases
- Unsupported SaaS providers
- Your own in-house APIs.

Forest Admin is built so that it does not know need the nature of the datasource it is speaking to, at long as it exposes a given interface.

That interface is only there to abstract away differences between backends so that they can be used as forest admin collections, it was built to allow for the minimal feature set which allow forest admin to work.

# Getting started

When creating a custom connector two routes can be taken:

| &nbsp;           | Using a local cache                                                                                                                                                                                         | Implement query translation                                                                                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| How does it work | All data from the target API/Database is copied and kept up to date on the agent server.<br><br>Then:<br>- Read operations are run in the local cache<br>- Write operations are forwarded to the target API | The connector translates all forest admin queries to the target API.                                                                                                                              |
| Preconditions    | Target API can sort records by last modification                                                                                                                                                            | Target API is capable of expressing filters, aggregating data, ...                                                                                                                                |
| Pros             | - Fast (uses sqlite under the hood)<br>-Easy to implement                                                                                                                                                   | - No disk usage<br>- No limits on quantity of data                                                                                                                                                |
| Cons             | - Slower agent start (need to synchronize all API data since last start)<br>- Disk Usage<br><br>- For some applications, quantity of data may be too large                                                  | - More difficult to implement<br>- When the feature gap between forest admin query system and the target API is large the connector would need to rely a lot on emulation which hurts performance |
| Recommended for  | SaaS and APIs                                                                                                                                                                                               | Databases or APIs with advanced query capabilities                                                                                                                                                |

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

{% tabs %} {% tab title="Using a local cache" %}

```javascript
const { BaseCollection, FieldTypes, PrimitiveTypes } = require('@forestadmin/connector-toolkit');
const axios = require('my-api-client'); // client for the target API

class MyCollection extends LocallyCachedCollection {
  constructor() {
    super(
      'myCollection', // Set name of the collection once imported
      '/tmp/cache-my-collection.db', // Set path of the caching file
    );

    // Add fields
    this.addField('id', {
      // As we are using a local cache, we only need to specify structure, not capabilities
      type: FieldsType.Column,
      columnType: PrimitiveType.Number,
      isPrimaryKey: true,
    });

    this.addField('title', {
      type: FieldsType.Column,
      columnType: PrimitiveType.String,
    });
  }

  /**
   * Example generator which
   * - yields all records modified since it was last called
   * - returns the next threshold value which should be used
   *
   * You are free to tune this generator as you see fit, depending on the capabilities and
   * performance of the API that you are targeting.
   *
   * In this example, the target API does not supports filters at all, but does support setting
   * sorting, skip and limit clauses.
   * For the sake of simplicity, we are assuming that no records get created while we're fetching
   * changes.
   */
  async *loadLastModified(lastThreshold) {
    let skip = 0;
    let limit = 1; // we'll increase this on subsequent calls
    let nextThreshold = lastThreshold; // null on first agent start

    while (true) {
      // Load batch of records from targeted data source
      const response = await axios.get(`https://myapi/resources/my-collection`, {
        params: { sort: '-updatedAt', skip, limit },
      });
      const records = response.body.items;

      // Save the threshold that should be used for the next call
      if (records.length && (nextThreshold === null || nextThreshold < records[0].updatedAt)) {
        nextThreshold = records[0].updatedAt;
      }

      // Do we have all modified records?
      const index = records.findIndex(record => record.updatedAt < lastThreshold);
      if (index === -1) {
        // We don't have all modified records (yet).
        yield records; // send everything we have to forest admin
        skip += records.length; // update skip to make sure we don't fetch the same records in a loop
        limit = Math.min(2000, limit * 2); // make limit larger
      } else {
        // We are done!
        yield records.slice(0, index); // send only modified records to forest admin
        return nextThreshold; // set parameter that will be provided for the next call
      }
    }
  }
}
```

{% endtab %} {% tab title="Using query translation" %}

```javascript
const { BaseCollection, FieldTypes, PrimitiveTypes } = require('@forestadmin/connector-toolkit');
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
      type: FieldsType.Column,
      columnType: PrimitiveType.Number,
      isPrimaryKey: true,

      // Capabilities (tell forest admin to which extend complex filters can be used).
      isReadOnly: true, // field is readonly
      filterOperators: new Set(), // field is not filterable
      isSortable: false, // field is not sortable
    });

    this.addField('title', {
      type: FieldsType.Column,
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
    const response = axios.get('https://myapi/resources/my-collection', { params });

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
    const response = axios.get('https://myapi/stats/my-collection', { params });

    return response.body.items;
  }
}

module.exports = MyCollection;
```

{% endtab %} {% tab title="Using the connector" %}

```javascript
const MyConnectorCollection = require('./connector-collection');

const agent = new Agent(options);

agent.importCollection(new MyConnectorCollection());
```

{% endtab %} {% endtabs %}
