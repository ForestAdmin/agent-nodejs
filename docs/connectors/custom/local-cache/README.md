<!-- Then, when using the local cache route:

- Implement a method which loads all records changed since a given date
- When relevant, implement methods for record creation, update and delete. -->

```javascript

  /**
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
```
