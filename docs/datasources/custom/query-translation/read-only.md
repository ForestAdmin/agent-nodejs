Developing your query translation layer is much easier when you can preview your work and have intermediary deliverables.

Emulation comes to the rescue: all features which are to be implemented when making a translating data source can be emulated inside your Node.js, at the cost of performance.

This enables to be up and running in minutes, and then optimizing your code as you go.

```javascript
const { BaseCollection } = require('@forestadmin/datasource-toolkit');
const axios = require('axios');

/**
 * This collection will have terrible performance, but is perfect to test that the structure
 * declaration is well done.
 */
class MyCollection extends BaseCollection {
  // [... Declare structure and capabilities]

  async list(recipient, filter, projection) {
    // Fetch all records on all requests (this is _very_ inefficient)
    const response = await axios.get('https://my-api/my-collection');
    const records = response.body.items;

    // Use "in-process emulation" for everything else.
    if (filter.conditionTree) result = filter.conditionTree.apply(result, this, recipient.timezone);
    if (filter.sort) result = filter.sort.apply(result);
    if (filter.page) result = filter.page.apply(result);
    if (filter.segment) throw new Error('This collection does not implements native segments');
    if (filter.search) throw new Error('This collection is not natively searchable');

    return projection.apply(result);
  }

  async aggregate(recipient, filter, aggregation, limit) {
    // Fetch all records which should be aggregated
    const records = await this.list(filter, aggregation.projection);

    // Use "in-process emulation" to aggregate the results
    return aggregation.apply(records, recipient.timezone, limit);
  }
}
```

# Tips

## Count queries

The `aggregate` method is used by forest admin both to count records and to extract the data which is needed to generate charts.

If the API/Database you are targeting have an efficient API which is made for counting records, you may want to handle this case first.

```javascript
const { BaseCollection } = require('@forestadmin/datasource-toolkit');
const axios = require('axios');

 class MyCollection extends BaseCollection {
  // [... Declare structure, capabilities and list method]

  async aggregate(filter, aggregation, limit) {
    const { operation, fields, groups } = aggregation;

    if (operation === 'Count' && groups.length === 0 && !field) {
      return [{ value: await this.count(filter) }];
    }

    // [... handle the general case]
  }

  async count(filter) {
    const response = await axios.get(
      `https://my-api/my-collection/count`,
      { params: { filter: this._translateFilter(filter) } }
    );

    return response.body.count;
  }

  private _translateFilter(filter) {
    // [... translate filter]
  }
}
```
