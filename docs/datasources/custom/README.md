Custom data sources are the answer to the need to import collections from either

- Your own in-house APIs.
- Unsupported databases
- Unsupported SaaS providers

Forest Admin is built so that it does not know need the nature of the datasource it is speaking to, at long as it exposes a given interface.

That interface is only there to abstract away differences between backends so that they can be used as forest admin collections, it was built to allow for the minimal feature set which allow forest admin to work.

# Getting started

When creating a custom data source two strategies can be used:

| -                | Using a local cache                                                                          | Implement query translation                                                         |
| ---------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Recommended for  | SaaS and APIs                                                                                | Databases or APIs with advanced query capabilities                                  |
| How does it work | All data is cached locally for read operations, write operations are forwarded to the target | The data source translates all forest admin queries to the target API in real time. |
| Preconditions    | Low: Target API can either sort or filter by last modification                               | High: Target API is capable of expressing filters, aggregating data, ...            |
| Pros             | Easy to implement and fast                                                                   | No disk usage and no limits on quantity of data                                     |
| Cons             | Slower agent start, Disk Usage, Quantity of data may be too large                            | More difficult to implement, and can be slow depending on target                    |

## Steps

Depending on your choice between "Local Cache" or "Query Translation", creating a data source is a very different task.

Local Cache:

1. Declaring the structure of the data
2. Implement a method which loads all records which changed since a provided date
3. When relevant, implement methods for record creation, update and delete

Query Translation:

1. Declaring the structure of the data
2. Declaring the API capabilities
3. Coding a translation layer

## Minimal example

{% tabs %} {% tab title="Datasource: Using a local cache" %}

```javascript
const { CachedCollection, PrimitiveTypes } = require('@forestadmin/datasource-toolkit');
const axios = require('my-api-client'); // client for the target API

class MyCollection extends CachedCollection {
  constructor(dataSource) {
    // Set name of the collection once imported
    super('myCollection', dataSource);

    // Add fields
    this.addField('id', {
      columnType: PrimitiveType.Number,
      isPrimaryKey: true,
      isReadOnly: true,
    });

    this.addField('title', {
      columnType: PrimitiveType.String,
    });
  }

  async listChangedRecords() {
    // When was this method last called?
    const lastRecords = await this.list(
      { sort: { field: 'updatedAt', ascending: true }, page: { limit: 1 } },
      ['updatedAt'],
    );
    const lastUpdate = lastRecords.length ? lastRecords[0].updatedAt : null;

    // Fetch everything which changed.
    const response = await axios.get(`https://my-api/my-collection`, {
      params: { filter: `updatedAt > '${lastUpdate}'` },
    });

    return response.body.items;
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

{% endtab %} {% tab title="Datasource: Using query translation" %}

```javascript
const { BaseCollection, PrimitiveTypes } = require('@forestadmin/datasource-toolkit');
const axios = require('axios'); // client for the target API

// The real work is in writing this module
// Expect a full featured query translation module to be over 1000 LOCs
const QueryGenerator = require('./forest-query-translation');

/** Minimal implementation of a readonly data source */
class MyCollection extends BaseCollection {
  constructor() {
    // Set name of the collection once imported
    super('myCollection');

    this.addField('id', {
      // Structure
      columnType: PrimitiveType.Number,
      isPrimaryKey: true,
      isReadOnly: true, // field is readonly

      // As we are using the query translation strategy => define capabilities
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

  async list(filter, projection) {
    const params = QueryGenerator.generateListQueryString(filter, projection);
    const response = axios.get('https://my-api/my-collection', { params });

    return response.body.items;
  }

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

{% endtab %} {% tab title="Agent: Using the data source" %}

```javascript
const MyDataSource = require('./data source');

const agent = new Agent(options);

agent.addDatasource(new MyDataSource());
```

{% endtab %} {% endtabs %}
