As a data source implementer, **you won't have to translate every possible query**: on most datasources, it is **not feasible**, as you will be restricted by the API that you will be translating queries for.

On construction each of your collections will declare per-field capabilities.

Forest Admin will then ensure that only queries using features that you have explicitely enabled are used.

# Required features

All data sources need to be able to

- List records
- Understand `And` nodes in condition trees
- Understand `Or` nodes in conditions trees
- Understand the `Equal` operator on primary keys
- Understand paging (`skip`, `limit`)

{% hint style="warning" %}
Translating the `Or` node is a strong contraint, as many backends will not allow it and providing a working implementation requires making multiple queries and recombining the results.
{% endhint %}

# Optional features

All optional features are opt-in, and need to be specified when constructing a data source, so that Forest Admin can know that they are available.

## How to unlock features

The more complete your query translator is, the most forest admin features will be unlocked

| Unlocked feature                                             | Needed capabilities                                              |
| ------------------------------------------------------------ | ---------------------------------------------------------------- |
| Displaying the number of pages in pagination widget          | Count                                                            |
| Using charts                                                 | Support all field in `Aggregation`                               |
| Using relations                                              | `In` on primary keys and foreign keys                            |
| Using `select all` feature for actions, delete or dissociate | `In` and `NotIn` on the primary key                              |
| Frontend filters, scopes and segments                        | See below                                                        |
| Using operator emulation                                     | `In` on primary keys                                             |
| Using search emulation                                       | `Contains` on string fields, `Equal` on numbers, uuids and enums |

## Unlock filtering, scopes and segments on GUI

Forest Admin GUI implements filtering, scopes and segments with a "per-field", not on a "per-field-and-operator" granularity.

This means that filtering for a given field is either enabled or not from the GUI perspective. Forest Admin admin panel will enable the feature only once enough operators are supported depending on the type of the field.

| Field type | Needed operators to unlock GUI filters, scopes and segments                                      |
| ---------- | ------------------------------------------------------------------------------------------------ |
| Boolean    | `Equal`, `NotEqual`, `Present`, `blank`                                                          |
| Date       | All dates operators                                                                              |
| Enum       | `Equal`, `NotEqual`, `Present`, `blank`,`In`                                                     |
| Number     | `Equal`, `NotEqual`, `Present`, `blank`,`In`, `GreaterThan`, LessThan`                           |
| String     | `Equal`, `NotEqual`, `Present`, `blank`,`In`,`StartsWith`,`EndsWith`, `Ccontains`, `NotContains` |
| Uuid       | `Equal`, `NotEqual`, `Present`, `Blank`                                                          |

# Collection level capabilities

## Count

![Pagination widget](../../../assets/customdatasource-count-capability.png)

Enabling this features allows the pagination widget to display the total number of pages in a collections while browsing records.

```javascript
class MyCollection extends BaseCollection {
  constructor() {
    // [...]

    // If you implemented the aggregate method
    this.enableCount();
  }
}
```

## Search

{% hint style="info" %}
If this feature is not enabled in the data source definition, users of your data source can still use the search bar in their admin panel (Forest Admin will default to building condition trees).
{% endhint %}

Enabling this feature allows you to either:

- Gain control on how search works for your data source instead of relying on the default implementation
- Allow full text search on data sources were the condition tree implementation is not strong enought

This is relevant mostly for data sources which target data sources which have native full text search capabilities (ElasticSearch, ...)

```javascript
class MyCollection extends BaseCollection {
  constructor() {
    // [...]

    // If you want to implement search youself
    this.enableSearch();
  }
}
```

## Segments

{% hint style="info" %}
If this feature is not enabled in the data source definition, users of your data source can still create segments in both their admin panels and agent customization.
{% endhint %}

Defining segments from your data sources can be relevant on three situations:

- Implementing segments in the data source can be more efficient than using the default condition tree based segments, at the cost of configurability (i.e. using complex SQL queries which cannot be expressed as a condition tree)
- The underlying datasource has a concept which maps to forest admin segments (i.e. ["scopes" in Sequelize](https://sequelize.org/master/manual/scopes.html))
- Your data source is used in multiple Forest Admin projects, and the segment should be shared across all deployments (i.e. segments coming from a public SaaS)

```javascript
class MyCollection extends BaseCollection {
  constructor() {
    // [...]

    // If you want to implement segments at the data source level
    this.addSegments(['Active records', 'Deleted records']);

    // From now on, all methods which take a filter as parameter *MUST* not ignore its segment
    // field.
  }
}
```

# Field level capabilities

## Write support

Fields may or may not be writable. To make a readonly use the `isReadOnly` flag.

```javascript
class MyCollection extends BaseCollection {
  constructor() {
    // [...]

    this.addField('id', {
      // [...]
      isReadOnly: true,
    });
  }
}
```

## Filtering operators

When declaring a field, the `filterOperators` set allows to tell Forest Admin which operators are supported by any given field.

Operators which are not explicitely enabled in that declaration won't be available.

```javascript
class MyCollection extends BaseCollection {
  constructor() {
    // [...]

    this.addField('id', {
      // [...]
      filterOperators: new Set([
        'Equal', // Tell forest admin that it can use the equal operator on the id field
        // ...
      ]),
    });
  }
}
```

## Sort

Not all fields need to be sortable. Fields which are sortable should be flagged in the following way.

```javascript
class MyCollection extends BaseCollection {
  constructor() {
    // [...]

    this.addField('id', {
      // [...]
      isSortable: true,
    });
  }
}
```
