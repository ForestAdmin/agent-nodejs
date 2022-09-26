Custom data sources are the answer to the need to import collections from either

- Your own in-house APIs.
- Unsupported databases.
- Unsupported SaaS providers.

Forest Admin is built so that it does not need know to the nature of the datasource it is speaking to, as long as it exposes a given interface.

That interface is only there to abstract away differences between backends so that they can be used as forest admin collections. It was built to allow for the minimal feature set which allow forest admin to work.

# Getting started

When creating a custom data source two strategies can be used:

| -                | Implement query translation                                                         |
| ---------------- | ----------------------------------------------------------------------------------- |
| Recommended for  | Databases or APIs with advanced query capabilities                                  |
| How does it work | The data source translates all forest admin queries to the target API in real time. |
| Preconditions    | Target API is capable of expressing filters, aggregating data, ...                  |

## Steps

Creating a custom datasource will require you to work on these 3 following steps:

1. Declare the structure of the data
2. Declare the API capabilities
3. Code a translation layer

## Minimal example

```javascript
const { BaseCollection } = require('@forestadmin/datasource-toolkit');
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
      columnType: 'Number',
      isPrimaryKey: true,
      isReadOnly: true, // field is readonly

      // As we are using the query translation strategy => define capabilities
      filterOperators: new Set(), // field is not filterable
      isSortable: false, // field is not sortable
    });

    this.addField('title', {
      columnType: 'String',
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

```javascript
const MyDataSource = require('./datasource');

const myDataSourceFactory = async () => new MyDataSource();

const agent = createAgent(options).addDataSource(myDataSourceFactory);
```

## Read more

Implementing a data source using the "query translation" strategy is an advanced concept: you will need to have a deep understanding of forest admin internals.

This strategy is a good match when writing data sources to full featured databases.

Before starting, it is highly advised to read and understand the following section:

- [Data Model](../../../under-the-hood/data-model/README.md)
  - [Typing](../../../under-the-hood/data-model/typing.md)
  - [Relationships](../../../under-the-hood/data-model/relationships.md)
- [Query interface](../../../under-the-hood/queries/README.md)
  - [Fields and projections](../../../under-the-hood/queries/fields-projections.md)
  - [Filters](../../../under-the-hood/queries/filters.md)
  - [Aggregations](../../../under-the-hood/queries/aggregations.md)
