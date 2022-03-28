The last step is to make your records editable.

This is achieved by implementing the `create`, `update` and `delete` methods, which all take a filter as parameter.

Note that unlike the `list` method, there is no need to support paging here.

```javascript
/** Naive implementation of create, update and delete on a REST API */
export default class MyCollection extends BaseCollection {
  // [... Declare structure, capabilities, list and aggregation methods]

  async create(records) {
    const promises = records.map(async record => {
      const response = await axios.post('https://my-api/my-collection', record);
      return response.body;
    });

    return Promise.all(promises); // Must return newly created records
  }

  async update(filter: Filter, patch: RecordData) {
    const records = await this.list(filter, ['id']); // Retrieve ids
    const promises = records.map(async ({ id }) => {
      await axios.patch(`https://my-api/my-collection/${id}`, patch);
    });

    await Promise.all(promises);
  }

  async delete(filter: Filter) {
    const records = await this.list(filter, ['id']); // Retrieve ids
    const promises = records.map(async ({ id }) => {
      await axios.delete(`https://my-api/my-collection/${id}`);
    });

    await Promise.all(promises);
  }
}
```
