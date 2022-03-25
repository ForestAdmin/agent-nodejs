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

# Paging

A paging clause tells your connector which page of the data should be retrieved.

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
