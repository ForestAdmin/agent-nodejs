- Declaring the API capabilities

  - Can records be listed?
    - Is the output filterable? On which fields? With which operators?
    - Is the output sortable? On which fields?
    - Do we need to fetch all fields on each request? Or can we query partial records?
    - Can the underlying data source load relations?
  - Can records be created?
  - Can records be updated?
  - Can records be deleted?
  - Can records be aggregated? (for charts / counting)

### Declaration of capabilities

Forest Admin does not need all operators to work on every field.
Actually it needs very few operators to work: implementing them will unlock features as you go.

When declaring a connector, the first step is to declare the structure and capabilities of the collections it contains.

Forest Admin ensures that operators which are not explicitely enabled in that declaration won't be used.

```javascript
class MyCollection extends BaseCollection {
  constructor() {
    // [...]

    this.addField('id', {
      // [...]
      filterOperators: new Set([
        Operator.Equal, // Tell forest admin that it can use the equal operator on the id field
        // ...
      ]),
    });
  }
}
```

### Declaration of capabilities

There is no declaration of capabilities for paging, as the feature is **mandatory** for all connectors.

### Declaration of capabilities

Implementation of search in a connector is actually opt-out.
Is you want forest admin to use the fields in the filters which are sent to your connector, your should opt-in by using the `enableSearch` method.

Not implementing it will simply hide the search bar fron the admin panel on the relevant collections.

```javascript
class MyCollection extends BaseCollection {
  constructor() {
    // [...]

    // If you want to implement search youself
    this.enableSearch();
  }
}
```

### Declaration of capabilities

In order to implement **connector defined** segments, you have to opt in, and provide the list of segment which will be under the responsibility of the connector

The only values which will be provided to your connectors in that fields, are the same values which are defined when declaring capabilities.

```javascript
class MyCollection extends BaseCollection {
  constructor() {
    // [...]

    // If you want to implement segments at the connector level
    this.addSegments(['Active records', 'Deleted records']);

    // From now on, all methods which take a filter as parameter *MUST* not ignore its segment
    // field.
  }
}
```
