Making your records editable is achieved by implementing the `create`, `update` and `delete` methods.

The three methods take a [filter](../../../under-the-hood/queries/filters.md) as parameter, but note that unlike the `list` method, there is no need to support paging.

```javascript
const { BaseCollection } = require('@forestadmin/datasource-toolkit');
const axios = require('axios'); // client for the target API

/** Naive implementation of create, update and delete on a REST API */
class MyCollection extends BaseCollection {
  constructor() {
    this.addField('id', { /* ... */ isReadOnly: true });
    this.addField('title', { /* ... */ isReadOnly: false });
  }

  async create(caller, records) {
    const promises = records.map(async record => {
      const response = await axios.post('https://my-api/my-collection', record);
      return response.body;
    });

    return Promise.all(promises); // Must return newly created records
  }

  async update(caller, filter, patch) {
    const records = await this.list(filter, ['id']); // Retrieve ids
    const promises = records.map(async ({ id }) => {
      await axios.patch(`https://my-api/my-collection/${id}`, patch);
    });

    await Promise.all(promises);
  }

  async delete(caller, filter) {
    const records = await this.list(filter, ['id']); // Retrieve ids
    const promises = records.map(async ({ id }) => {
      await axios.delete(`https://my-api/my-collection/${id}`);
    });

    await Promise.all(promises);
  }
}
```
