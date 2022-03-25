A filter represents a subset of records _within a collection_.
As such, a filter always exists on the context of a given collection.

It is used to restrict the records which will be targeted by specific actions (list, update, aggregate, ...)

```json
{
  // Condition tree
  "conditionTree": { "field": "createdAt", "operator": "today" },
  "timezone": "Europe/Paris",

  // Paging
  "page": { "limit": 30, "skip": 0 },
  "sort": [
    { "field": "title", "ascending": true },
    { "field": "id", "ascending": true }
  ],

  // Search [advanced]
  "search": "John Smith",
  "searchExtended": false,

  // Segment [advanced]
  "segment": "Active Records"
}
```

This is quite complex! Let's break it down to small understandable pieces.

Before starting, note that as a connector implementer, **you won't have to translate every possible filter.**
On most datasources, it is **not feasible**, as you will be restricted by the API that you will be translating forest admin filters to.

On construction each of your collections and fields will declare capabilities.
Forest Admin will then ensure that only filters using feature that you have explicitely enabled are used.

All other features will either be disabled from your admin panel (or emulated with lower performance when specified).

# Condition trees

A condition tree, as it names imply, is a set of conditions which apply on the records themselves and tells which records should be included or excluded from a given query.

## Examples

Simple condition tree

```json
{ "field": "title", "operator": "starts_with", "value": "Found" }
```

With multiple conditions

```json
{
  "aggregator": "and",
  "conditions": [
    { "field": "title", "operator": "equal", "value": "Foundation" },
    { "field": "subTitle", "operator": "equal", "value": "The Psychohistorians" }
  ]
}
```

With multiple conditions and not node

```json
{
  "aggregator": "and",
  "conditions": [
    { "field": "title", "operator": "like", "value": "found%" },
    { "not": { "field": "createdAt", "operator": "today" } }
  ]
}
```

## Structure

Each node of a condition tree can be one of five things:

- A "Not" branch: `{ not: <otherNode> }`
- An "And" branch: `{ aggregator: 'or', conditions: [<otherNodes>] }`
- An "Or" branch: `{ aggregator: 'or', conditions: [<otherNodes>] }`
- A "condition" leaf without parameter: `{ field: 'title', operator: 'present' }`
- A "condition" leaf with parameter: `{ field: 'title', operator: 'equal', value: 'Foundation' }`

## Operators

Here is the list of operators which are supported by forest admin.

| Operator                 | Types         | Expected parameter  |
| ------------------------ | ------------- | ------------------- |
| present                  | All           | ∅                   |
| blank                    | All           | ∅                   |
| missing                  | All           | ∅                   |
| equal                    | All but array | Field type          |
| not_equal                | All but array | Field type          |
| less_than                | All but array | Field type          |
| greater_than             | All but array | Field type          |
| in                       | All but array | Array of field type |
| not_in                   | All but array | Array of field type |
| like                     | String        | String              |
| starts_with              | String        | String              |
| ends_with                | String        | String              |
| contains                 | String        | String              |
| not_contains             | String        | String              |
| longer_than              | String        | Number              |
| shorter_than             | String        | Number              |
| before                   | Date          | Date                |
| after                    | Date          | Date                |
| after_x_hours_ago        | Date          | Number              |
| before_x_hours_ago       | Date          | Number              |
| past                     | Date          | ∅                   |
| future                   | Date          | ∅                   |
| previous_month_to_date   | Date          | ∅                   |
| previous_month           | Date          | ∅                   |
| previous_quarter_to_date | Date          | ∅                   |
| previous_quarter         | Date          | ∅                   |
| previous_week_to_date    | Date          | ∅                   |
| previous_week            | Date          | ∅                   |
| previous_x_days_to_date  | Date          | Number              |
| previous_x_days          | Date          | Number              |
| previous_year_to_date    | Date          | ∅                   |
| previous_year            | Date          | ∅                   |
| today                    | Date          | ∅                   |
| yesterday                | Date          | ∅                   |
| includes_all             | Array         | Array               |

## Implementation

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

### How high should you aim?

| Unlocked feature                                             | Needed capabilities                                              |
| ------------------------------------------------------------ | ---------------------------------------------------------------- |
| Minimal feature set                                          | `and` + `or` nodes<br/>`equal` on primary keys and foreign keys  |
| Using relations                                              | `in` on primary keys and foreign keys                            |
| Using `not` node in your code                                | `not` node                                                       |
| Using operator emulation on any field                        | `in` on the primary key                                          |
| Using search emulation                                       | `contains` on string fields, `equal` on numbers, uuids and enums |
| Using `select all` feature for actions, delete or dissociate | `in` and `not_in` on the primary key                             |
| Frontend filters, scopes and segments                        | See below                                                        |

{% hint style="warning" %}
Translating the `or` node is a strong contraint, as many backends will not allow it and providing a working implementation requires making multiple queries and recombining the results.
{% endhint %}

{% hint style="warning" %}
Forest Admin frontend implements filtering, scopes and segments with a "per-field", not on a "per-field-and-operator" granularity.

This means that filtering for a given field is either enabled or not from the frontend perspective. Forest Admin admin panel will enable the feature only once enough operators are supported depending on the type of the field.

| Field type | Needed operators to unlock frontend filters, scopes and segments                               |
| ---------- | ---------------------------------------------------------------------------------------------- |
| Boolean    | `equal`,`not_equal`,`present`,`blank`,                                                         |
| Date       | All dates operators                                                                            |
| Enum       | `equal`,`not_equal`,`present`,`blank`, `in`                                                    |
| Number     | `equal`,`not_equal`,`present`,`blank`,`in`,`greater_than`,`less_than`                          |
| String     | `equal`,`not_equal`,`present`,`blank`,`in`,`starts_with`,`ends_with`,`contains`,`not_contains` |
| Uuid       | `equal`, `not_equal`, `present`, `blank`                                                       |

{% endhint %}

### Operator equivalence

You may have noticed that many operators overlap. In order to make it quicker to implement connectors, forest admin supports automatic operator replacement.

What that means, is that when an operator can be expressed using a combination of other operators, forest admin will perform the substitution automatically using the following table.

Among all operators, the following tables shows those which have equivalence rules.

| Operator                 | Types         | Automatic replacement                                                |
| ------------------------ | ------------- | -------------------------------------------------------------------- |
| present                  | All           | not_equal null and not_equal ''                                      |
| blank                    | All           | equal null or equal ''                                               |
| missing                  | All           | equal null                                                           |
| equal                    | All           | in [$value]                                                          |
| not_equal                | All but array | not_in [$value]                                                      |
| in                       | All but array | equal $value or equal $2 or ...                                      |
| not_in                   | All but array | not_equal $value and not_equal $2 and ...                            |
| starts_with              | String        | like '$value%'                                                       |
| ends_with                | String        | like '%$value'                                                       |
| contains                 | String        | like '%$value%'                                                      |
| before                   | Date          | less_than $value                                                     |
| after                    | Date          | greater_than $value                                                  |
| after_x_hours_ago        | Date          | greater_than $hours_ago($value)                                      |
| before_x_hours_ago       | Date          | less_than $hours_ago($value)                                         |
| past                     | Date          | less_than $now                                                       |
| future                   | Date          | greater_than $now                                                    |
| previous_month_to_date   | Date          | greater_than $start_of_month & less_than $now                        |
| previous_month           | Date          | greater_than $start_of_last_month & less_than $end_of_last_month     |
| previous_quarter_to_date | Date          | greater_than $start_of_quarter & less_than $now                      |
| previous_quarter         | Date          | greater_than $start_of_last_quarter & less_than $end_of_last_quarter |
| previous_week_to_date    | Date          | greater_than $start_of_week & less_than $now                         |
| previous_week            | Date          | greater_than $start_of_last_week & less_than $end_of_last_week       |
| previous_x_days_to_date  | Date          | greater_than $x_days_ago($value) & less_than $now                    |
| previous_x_days          | Date          | greater_than $x_days_ago($value) & less_than $start_of_today         |
| previous_year_to_date    | Date          | greater_than $start_of_year & less_than $now                         |
| previous_year            | Date          | greater_than $start_of_last_year & less_than $end_of_last_year       |
| today                    | Date          | greater_than $start_of_today and less_than $end_of_today             |
| yesterday                | Date          | greater_than $start_of_yesterday and less_than $end_of_yesterday     |

In practice:

- if you support `equal`, your field will automatically support `blank` and `missing`
- if you support `less_than`, your field will automatically support `before`, `before_x_hours_ago` and `past`
- ... and so on

The minimal list of operators which should be supported to have them all is the following

- `in` and `not_in` (unlocks `present`, `blank`, `missing`, `equal` and `not_equal`)
- `less_than` and `greater_than` (unlocks all dates operators)
- `like` (unlocks `starts_with`, `ends_with` and `contains`)
- `not_contains`, `longer_than`, `shorter_than` and `includes_all`

### Emulation

Developing your query translation layer is much easier when you can preview your work and have intermediary deliverables.

The same goes is you need some features on your admin panel, but the datasource you are targeting does not implement them.

Emulation comes to the rescue: all features which are to be implemented when making a translating connector can be emulated inside your NodeJS, at the cost of performance.

This enables to be up and running in minutes by overfetching data, and then optimizing your code as you go.

```javascript
const { ConditionTreeFactory } = require('@forestadmin/connector-toolkit');


const collection = ...;
const timezone = ...;
const tree = ConditionTreeFactory.fromPlainObject({
  aggregator: 'and',
  conditions: [
    { field: 'id', operator: 'greater_than', value: 34 },
    { field: 'title', operator: 'like', value: 'found%' },
  ],
});

const records = [
  { id: 17, title: 'Foundation' },
  { id: 35, title: 'I, Robot' },
  { id: 67, title: 'Foundation and Empire' },
  { id: 89, title: 'The Last Question' },
];

const filteredRecords = tree.apply(records, collection, timezone);
// => [{ id: 67, title: 'Foundation and Empire' }];
```

# Paging

## Examples

```json
{
  "page": { "limit": 30, "skip": 0 },
  "sort": [
    { "field": "title", "ascending": true },
    { "field": "id", "ascending": true }
  ]
}
```

## Implementation

### Declaration of capabilities

There is no declaration of capabilities for paging, as the feature is **mandatory** for all connectors.

### Emulation

Emulation is available to help you during the early stages of your translating connector.

```javascript
const sort = new Sort({ field: 'title', ascending: true }, { field: 'id', ascending: true });
const page = new Page(3, 2); // skip, limit

const records = [
  { id: 17, title: 'Foundation' },
  { id: 35, title: 'I, Robot' },
  { id: 67, title: 'Foundation and Empire' },
  { id: 89, title: 'The Last Question' },
];

const sortedRecords = sort.apply(records);
// => [
//   { id: 17, title: 'Foundation' },
//   { id: 67, title: 'Foundation and Empire' },
//   { id: 35, title: 'I, Robot' },
//   { id: 89, title: 'The Last Question' },
// ]

const paginatedRecords = page.apply(sortedRecords);
// => [{ id: 89, title: 'The Last Question' }]
```

# Search

The `search` field in a filter simply is what the final user typed in the search bar in the admin panel, an can be used to restrict records.

Likewise `searchExtended` boolean is an action which can be triggered by end-users when a given search returns no results and its implementation can vary from connector to connector.

For instance, in `@forestadmin/connector-sql`, the `searchExtended` flag is used to also search content into all collections which are linked with a `many to one` or `one to one` relation to the current one.

{% hint style="info" %}
This is an advanced concept.

If this feature is not enabled in the connector definition, you can consider this field to always be `null` and the feature will be handled by Forest Admin for you.

Enabling this feature allows you to have more control on how search works for your connector for datasources were native full text indexes are available (elasticsearch, ...)
{% endhint %}

## Examples

Search into current collection

```json
{ "search": "Isaac", "searchExtended": false }
```

Search into current and linked collections

```json
{ "search": "Isaac", "searchExtended": true }
```

## Implementation

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

### Emulation

If the datasource you are targeting supports the `equal` and `contains` operators on at least some fields, the search bar will be displayed.

Using it will add conditions to the condition tree.

# Segments

The `segment` field in a filter contains the name of the segment which is being targeted.

{% hint style="info" %}
This is an advanced concept.

If this feature is not enabled in the connector definition, you can consider this field to always be `null` and the feature will be handled by Forest Admin for you.

This can be useful on three situations:

- In some use-cases, implementing segments in the connector can be more efficient than using condition tree based segments, at the cost of configurability (i.e. using complex SQL queries which cannot be expressed as a condition tree)
- The underlying datasource has a concept which maps to forest admin segments (i.e. Sequelize scopes)
- Your connector is used in multiple Forest Admin projects, and the segment should be shared across all deployments (i.e. segments coming from a public SaaS)

{% endhint %}

## Examples

```json
{ "segment": "Active records" }
```

## Implementation

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

### Emulation

There is no emulation for connector defined segments, as that feature can be safely ignored without any impact on the final admin panel functionalities.
