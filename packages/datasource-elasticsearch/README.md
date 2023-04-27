The elastic search data source allows importing collections from an elastic search instance.

To make everything work as expected, you need to install the package `@forestadmin/datasource-elasticsearch`.

Note that:

- It has been developed with version 7 in mind. Support for elastic search v8 will come later.
- Joins are not supported
- Points are not supported

```javascript
const { createAgent } = require('@forestadmin/agent');

const { createElasticsearchDataSource } = require('@forestadmin/datasource-elasticsearch');

// Create agent and import collections from elastic search
const agent = createAgent(options).addDataSource(
    createElasticsearchDataSource('http://localhost:9200', configuration =>
      configuration
        // Add the kibana_sample_data_flights index example
        .addCollectionFromIndex({ name: 'Flights', indexName: 'kibana_sample_data_flights' })

        // Add the kibana_sample_data_ecommerce index example
        .addCollectionFromIndex({ name: 'eCommerce', indexName: 'kibana_sample_data_ecommerce' })

        // Add a custom collection template based
        .addCollectionFromTemplate({
          name: 'ActivityLogs',
          templateName: 'activity-logs-v1-template',
          // Allow to properly generate index name for records creation based on custom logic
          // activity-logs-v1-read-2023_05
          generateIndexName: ({ type, createdAt }) => {
            const createdDate = new Date(createdAt).toISOString();
            // NOTICE: getMonth() returns the month as a zero-based value
            const month = new Date(createdDate).getUTCMonth() + 1;

            const dateSuffix = `${new Date(createdDate).getUTCFullYear()}_${
              month < 10 ? '0' : ''
            }${month}`;

            return `activity-logs-v1-${type}-${dateSuffix}`;
          },
        }),
    ),
  ));
```
