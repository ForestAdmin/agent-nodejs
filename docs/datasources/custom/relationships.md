We've seen that when building data sources, collections must fulfill the contract they defined [when declaring their capabilities](./capabilities.md).

The same is also true for [Intra-data source relationships](./structure.md#relationships) which are declared on the structure of a collection: declared relations must be handled when processing `filters`, `projection`, and `aggregations`.

# In practice

`one-to-many` and `many-to-many` relationships do not require additional work: Forest Admin will automatically call the destination collection with a valid filter.

On the other hand, `many-to-one` and `one-to-one` relationships require the implementer to make all fields from the target collection available on the source collection (under a prefix).

## Example

If a structure declaration contains the following statement

```javascript
class MovieCollection extends BaseCollection {
  constructor() {
    super('movies');

    // [...]

    this.addField('director', {
      type: 'ManyToOne',
      foreignCollection: 'people',
      foreignKey: 'directorId',
      foreignKeyTarget: 'id',
    });
  }
}
```

Then the collection must accept references to fields from the `people` collection under the `director` prefix in all method parameters.

```javascript
// The following call is using both fields from the "movies" and "people" collection
await dataSource.getCollection('movies').list(
  {
    conditionTree: {
      aggregator: 'And',
      conditions: [
        { field: 'title', operator: 'Equal', value: 'E.T.' },
        { field: 'director:firstName', operator: 'Equal', value: 'Stephen' },
      ]
    }.
    sort: [{ field: 'director:birthDate', ascending: true }]
  },
  ['id', 'title', 'director:firstName', 'director:lastName']
);
```

should return

```json
{
  "id": 34,
  "title": "E.T",
  "director": { "firstName": "Stephen", "lastName": "Spielberg" }
}
```
