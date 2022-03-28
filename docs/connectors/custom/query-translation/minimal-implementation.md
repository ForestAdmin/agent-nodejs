Developing your query translation layer is much easier when you can preview your work and have intermediary deliverables.

Emulation comes to the rescue: all features which are to be implemented when making a translating connector can be emulated inside your NodeJS, at the cost of performance.

This enables to be up and running in minutes by overfetching data, and then optimizing your code as you go.

```javascript
/**
 * This collection will have terrible performance, but is perfect to test that the structure
 * declaration is well done.
 */
export default class MyCollection extends BaseCollection {
  constructor() {
    // [... Declare structure and capabilities]
  }

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
