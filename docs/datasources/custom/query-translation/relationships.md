We've seen that when building datasources using the "query translation" strategy, collection must fulfill the contract they defined [when declaring their capabilities](./capabilities.md).

The same is also true for [Intra-datasource relationships](../structure.md#relationships) which are declared on the structure of a collection: declared relations must be handled when processing `filters` and `projection`.

# In practice

Relationships which yield more than one record ("one to many" and "many to many") actually don't require additional work, because Forest Admin will automatically call the destination collection with a valid filter.

On the other hand, "Many to one" and "one to one" relationships require the implementer to make all fields from the target collection available on the source collection (under a prefix).

## Example

If a collection' structure declaration contains the following statement

```javascript
class MovieCollection extends BaseCollection {
  constructor() {
    super('movies');

    // [...]

    this.addRelation('director', {
      type: FieldTypes.ManyToOne,
      foreignCollection: 'people',
      foreignKey: 'directorId',
      foreignKeyTarget: 'id',
    });
  }
}
```

Then the collection must accept references to fields from the `people` collection in `filters`, `projections` and `aggregations` parameters on all methods which are implemented by the collection

```javascript
// The following call is using both fields from the "movies" and "people" collection
await dataSource.getCollection('movies').list(
  {
    conditionTree: {
      aggregator: 'and',
      conditions: [
        { field: 'title', operator: 'equal', value: 'E.T.' },
        { field: 'director:firstName', operator: 'equal', value: 'Stephen' },
      ]
    }.
    sort: [{ field: 'director:birthDate', ascending: true }]
  },
  ['id', 'title', 'director:firstName', 'director:lastName']
);
```

should return

```json
{ "id": 34, "title": "E.T", "director": { "firstName": "Stephen", "lastName": "Spielberg" } }
```

# Alternative: using a decorator

{% hint style='warning' %}
When using a decorator to emulate behaviors (in this case, relationships), do not duplicate the declaration of the relation
{% endhint %}

If the API which is being targeted does not support filtering and fetching fields from relationships natively, you may want to use the technique that we're using for "Inter-datasource relations" to define the "Intra-datasource relations" that binds the collections from your data source.

At the cost of performance, everything would then work out of the box.

```javascript
const {
  DataSourceDecorator,
  FieldTypes,
  JointureCollectionDecorator,
} = require('@forestadmin/datasource-toolkit');
const MyDataSource = require('./datasource');

module.exports = function makeMyDataSourceWithRelations() {
  const myDataSource = new MyDataSource();
  const jointures = new DataSourceDecorator(myDataSource, JointureCollectionDecorator);

  jointures.getCollection('movies').addJointure('director', {
    type: FieldTypes.ManyToOne,
    foreignCollection: 'people',
    foreignKey: 'directorId',
    foreignKeyTarget: 'id',
  });

  return jointures;
};
```
