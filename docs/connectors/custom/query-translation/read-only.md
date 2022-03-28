Developing your query translation layer is much easier when you can preview your work and have intermediary deliverables.

Emulation comes to the rescue: all features which are to be implemented when making a translating connector can be emulated inside your NodeJS, at the cost of performance.

This enables to be up and running in minutes, and then optimizing your code as you go.

```javascript
const { BaseCollection } = require('@forestadmin/connector-toolkit');
const axios = require('axios');

/**
 * This collection will have terrible performance, but is perfect to test that the structure
 * declaration is well done.
 */
export default class MyCollection extends BaseCollection {
  // [... Declare structure and capabilities]

  async list(filter, projection) {
    // Fetch all records on all requests (this is _very_ inefficient)
    const response = await axios.get('https://my-api/my-collection');
    const records = response.body.items;

    // Use "in-process emulation" for everything else.
    if (filter.conditionTree) result = filter.conditionTree.apply(result, this, filter.timezone);
    if (filter.sort) result = filter.sort.apply(result);
    if (filter.page) result = filter.page.apply(result);
    if (filter.segment) throw new Error('This collection does not implements native segments');
    if (filter.search) throw new Error('This collection is not natively searchable');

    return projection.apply(result);
  }

  async aggregate(filter, aggregation, limit) {
    // Fetch all records which should be aggregated
    const records = await this.list(filter, aggregation.projection);

    // Use "in-process emulation" to aggregate the results
    const rows = aggregation.apply(records, filter.timezone);
    return limit ? rows.slice(0, limit) : rows;
  }
}
```

# Tips

## Count queries

The `aggregate` method is used by forest admin both to count records and to extract the data which is needed to generate charts.

If the API/Database you are targeting have an efficient API which is made for counting records, you may want to handle this case first: performance-wise the return over investment will be larger as count queries are frequent.

```javascript
const { BaseCollection } = require('@forestadmin/connector-toolkit');
const axios = require('axios');

export default class MyCollection extends BaseCollection {
  // [... Declare structure, capabilities and list method]

  async aggregate(filter, aggregation, limit) {
    const isCountQuery =
      aggregation.operation === 'Count' && aggregation.groups.length === 0 && !aggregation.field;

    if (isCountQuery) {
      const response = await axios.get(
        `https://my-api/my-collection/count?filter=${this._translateFilter(filter)}`,
      );

      return response.body.count;
    } else {
      // Fetch all records which should be aggregated
      const records = await this.list(filter, aggregation.projection);

      // Use "in-process emulation" to aggregate the results
      const rows = aggregation.apply(records, filter.timezone);
      return limit ? rows.slice(0, limit) : rows;
    }
  }

  private _translateFilter(filter) {
    // [... translate filter]
  }
}
```
