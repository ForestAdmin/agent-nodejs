With the "local cache" strategy, Forest Admin needs to be able to always maintain an up-to-date copy of the data which is stored in the target API.

This is achieved by implementing a single method which allow to access _records which have changed_.

How to implement it can vary a lot depending on the feature set of the API which you are targeting, however keep in mind that in order to avoid sending stale data, Forest Admin will call the method **before each read and write operation**.

You should optimize the method to be fast when nothing has changed on the target API.

## API supports filtering

If the API you are targeting supports filtering, the implementation should be trivial.

```javascript
const { BaseCollection } = require('@forestadmin/datasource-toolkit');
const axios = require('my-api-client'); // client for the target API

class MyCollection extends CachedCollection {
  // [... Declare structure]

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
```

## API supports descending sort

When filtering is not supported, this can be worked around by using the sorting ability of the API you are targeting.

In this example we choose to:

- Fetch only one record on the first request
- Gradually increase the page size up to a limit when we need to catch-up

```javascript
const { CachedCollection } = require('@forestadmin/datasource-toolkit');
const axios = require('axios'); // client for the target API

class MyCollection extends CachedCollection {
  // [... Declare structure]

  async listChangedRecords() {
    // When was this method last called?
    const lastRecords = await this.list(
      { sort: { field: 'updatedAt', ascending: true }, page: { limit: 1 } },
      ['updatedAt'],
    );
    const lastUpdate = lastRecords.length ? lastRecords[0].updatedAt : null;

    // Fetch records
    const records = [];
    let limit = 1; // we'll increase this on subsequent calls

    while (true) {
      // Load batch of records from targeted data source
      const response = await axios.get(`https://my-api/my-collection`, {
        params: { sort: '-updatedAt', skip: records.length, limit },
      });

      // Do we have all modified records?
      const index = response.body.items.findIndex(record => record.updatedAt < lastUpdate);
      if (index === -1) {
        // We don't have all modified records (yet).
        records.push(...response.body.items); // send everything we have to forest admin
        limit = Math.min(1000, limit * 2); // make limit larger
      } else {
        // We are done!
        records.push(...response.body.items.slice(0, index));
        break;
      }
    }

    return records;
  }
}
```
