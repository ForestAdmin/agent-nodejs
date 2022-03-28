With the "local cache" strategy, Forest Admin needs to be able to always maintain an up-to-date copy of the data which is stored in the target API.

This is achieved by implementing a single method which allow to access _records which have changed_.

The strategy to write this method can vary depending on the feature set of the API which you are targeting

# Examples

## API supports filtering

If the API you are targeting supports filtering, the implementation should be trivial.

```javascript
const { BaseCollection } = require('@forestadmin/connector-toolkit');
const axios = require('my-api-client'); // client for the target API

class MyCollection extends LocallyCachedCollection {
  // [... Declare structure]

  async *loadLastModified(lastThreshold) {
    while (true) {
      const response = await axios.get(`https://my-api/my-collection`, {
        params: { filter: `updatedAt > '${lastThreshold}'`, limit: 1000 },
      });

      yield response.body.items;

      if (response.body.items < 1000) break;
    }

    // Compute threshold for next call
    return new Date().toISOString();
  }
}
```

## API supports descending sort

When filtering is not supported, this can be worked around by using the sorting ability of the API you are targeting.

The method may be called very often. You should optimize the method so that the method is fast when nothing has changed on the target API.

In this example we choose to:

- Fetch only one record on the first request
- Gradually increase the page size up to a limit when we need to catch-up

```javascript
const { LocallyCachedCollection } = require('@forestadmin/connector-toolkit');
const axios = require('axios'); // client for the target API

class MyCollection extends LocallyCachedCollection {
  // [... Declare structure]

  async *loadLastModified(lastThreshold) {
    let skip = 0;
    let limit = 1; // we'll increase this on subsequent calls

    while (true) {
      // Load batch of records from targeted data source
      const response = await axios.get(`https://my-api/my-collection`, {
        params: { sort: '-updatedAt', skip, limit },
      });
      const records = response.body.items;

      // Do we have all modified records?
      const index = records.findIndex(record => record.updatedAt < lastThreshold);
      if (index === -1) {
        // We don't have all modified records (yet).
        yield records; // send everything we have to forest admin
        skip += records.length; // update skip to make sure we don't fetch the same records in a loop
        limit = Math.min(1000, limit * 2); // make limit larger
      } else {
        // We are done!
        yield records.slice(0, index); // send only modified records to forest admin
        break;
      }
    }

    // Compute threshold for next call
    return new Date().toISOString();
  }
}
```
