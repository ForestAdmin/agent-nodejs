The last step is to make your records editable.

This is achieved by implementing the `create`, `update` and `delete` methods, which all take a filter as parameter.

Note that unlike the `list` method, there is no need to support paging here.

```javascript
/** Naive implementation of create, update and delete on a REST API */
export default class MyCollection extends BaseCollection {
  constructor() {
    // [... Declare structure and capabilities]
  }

  async list(filter, projection) {
    // [... Implement list]
  }

  async aggregate(filter, aggregation, limit) {
    // [... Implement aggregate]
  }

  async create(records) {
    // Create records on target api
    const promises = records.map(async record => {
      const response = await axios.post('https://my-api/my-collection', record);
      return response.body;
    });

    // Return newly created records
    return Promise.all(promises);
  }

  async update(filter: Filter, patch: RecordData) {
    // Fetch id of records which should be updated
    const records = await this.list(filter, ['id']);

    // Update records
    await Promise.all(
      records.map(async ({ id }) => {
        await axios.patch(`https://my-api/my-collection/${id}`, patch);
      }),
    );

    // Returns void
  }

  async delete(filter: Filter) {
    // Fetch id of records which should be deleted
    const records = await this.list(filter, ['id']);

    // Delete records
    await Promise.all(
      records.map(async ({ id }) => {
        await axios.delete(`https://my-api/my-collection/${id}`);
      }),
    );

    // Returns void
  }
}
```
