<!-- - Declaring the API capabilities

  - Can records be listed?
    - Is the output filterable? On which fields? With which operators?
    - Is the output sortable? On which fields?
    - Do we need to fetch all fields on each request? Or can we query partial records?
    - Can the underlying data source load relations?
  - Can records be created?
  - Can records be updated?
  - Can records be deleted?
  - Can records be aggregated? (for charts / counting) -->

As a connector implementer, **you won't have to translate every possible query**: on most datasources, it is **not feasible**, as you will be restricted by the API that you will be translating forest admin filters to.

On construction each of your collections will declare per-field capabilities.

Forest Admin will then ensure that only queries using features that you have explicitely enabled are used.

# Required features

All connectors need to be able to

- List and count records
- Understand `And` nodes in condition trees
- Understand `Or` nodes in conditions trees
- Understand the `equal` operator on primary and foreign keys
- Understand paging (`skip`, `limit`)

{% hint style="warning" %}
Translating the `or` node is a strong contraint, as many backends will not allow it and providing a working implementation requires making multiple queries and recombining the results.
{% endhint %}

# Optional features

All optional features are opt-in, and need to be specified when constructing a connector, so that Forest Admin can know that they are available.

## How to unlock features

The more complete your query translator is, the most forest admin features will be unlocked on your connector

| Unlocked feature                                             | Needed capabilities                                              |
| ------------------------------------------------------------ | ---------------------------------------------------------------- |
| Using relations                                              | `in` on primary keys and foreign keys                            |
| Using `select all` feature for actions, delete or dissociate | `in` and `not_in` on the primary key                             |
| Frontend filters, scopes and segments                        | See below                                                        |
| Using operator emulation                                     | `in` on primary keys                                             |
| Using search emulation                                       | `contains` on string fields, `equal` on numbers, uuids and enums |
| Using `not` node in your code                                | `not` node                                                       |

## Unlock filtering, scopes and segments on GUI

Forest Admin GUI implements filtering, scopes and segments with a "per-field", not on a "per-field-and-operator" granularity.

This means that filtering for a given field is either enabled or not from the GUI perspective. Forest Admin admin panel will enable the feature only once enough operators are supported depending on the type of the field.

| Field type | Needed operators to unlock GUI filters, scopes and segments                                    |
| ---------- | ---------------------------------------------------------------------------------------------- |
| Boolean    | `equal`,`not_equal`,`present`,`blank`,                                                         |
| Date       | All dates operators                                                                            |
| Enum       | `equal`,`not_equal`,`present`,`blank`, `in`                                                    |
| Number     | `equal`,`not_equal`,`present`,`blank`,`in`,`greater_than`,`less_than`                          |
| String     | `equal`,`not_equal`,`present`,`blank`,`in`,`starts_with`,`ends_with`,`contains`,`not_contains` |
| Uuid       | `equal`, `not_equal`, `present`, `blank`                                                       |

## Filtering: Condition trees

When declaring a field, the `filterOperators` set allows to tell Forest Admin which operators are supported by any given field.

Operators which are not explicitely enabled in that declaration won't be available.

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

## Filtering: Paging

Supporting `skip` and `limit` on filters is a required feature, so there is no declaration for that.

However, not all fields need to be sortable.

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

## Filtering: Search

{% hint style="info" %}
If this feature is not enabled in the connector definition, users of your connector can still use the search bar in their admin panel.
{% endhint %}

If this feature is not explicitly enabled in the connector definition, Forest Admin will use condition trees to implement the search bar in the admin panel. When that is not possible, because the condition tree implementation itself is not sufficient, the search bar will be disabled.

Therefor, enabling this feature allows you to either:

- Gain control on how search works for your connector instead of relying on the default implementation
- Allow full text search on connectors were the condition tree implementation is not strong enought

Is you want forest admin to use the fields in the filters which are sent to your connector, your should opt-in by using the `enableSearch` method.

```javascript
class MyCollection extends BaseCollection {
  constructor() {
    // [...]

    // If you want to implement search youself
    this.enableSearch();
  }
}
```

## Filtering: Segments

{% hint style="info" %}
If this feature is not enabled in the connector definition, users of your connector can still create segments in both their admin panels and agent customization.
{% endhint %}

Defining segments from your connectors can be relevant on three situations:

- Implementing segments in the connector can be more efficient than using the default condition tree based segments, at the cost of configurability (i.e. using complex SQL queries which cannot be expressed as a condition tree)
- The underlying datasource has a concept which maps to forest admin segments (i.e. ["scopes" in Sequelize](https://sequelize.org/master/manual/scopes.html))
- Your connector is used in multiple Forest Admin projects, and the segment should be shared across all deployments (i.e. segments coming from a public SaaS)

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
