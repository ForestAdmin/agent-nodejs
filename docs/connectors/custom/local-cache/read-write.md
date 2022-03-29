Making your records editable is achieved by implementing the `create`, `update` and `delete` methods.

```javascript
const { CachedCollection } = require('@forestadmin/datasource-toolkit');
const axios = require('axios'); // client for the target API

class MyCollection extends CachedCollection {
  constructor() {
    this.addField('id', { /* ... */ isReadOnly: true });
    this.addField('title', { /* ... */ isReadOnly: false });
  }

  async create(records) {
    const promises = records.map(async record => {
      const response = await axios.post('https://my-api/my-collection', record);
      return response.body;
    });

    return Promise.all(promises); // Must return newly created records
  }

  async update(ids, patch) {
    const promises = records.map(async ({ id }) => {
      await axios.patch(`https://my-api/my-collection/${id}`, patch);
    });

    await Promise.all(promises);
  }

  async delete(ids) {
    const promises = records.map(async ({ id }) => {
      await axios.delete(`https://my-api/my-collection/${id}`);
    });

    await Promise.all(promises);
  }
}
```
