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

## Operator equivalence

You may have noticed that many operators overlap. In order to make connectors quicker to implement, forest admin supports automatic operator replacement.

What that means, is that when an operator can be expressed using a combination of other operators, forest admin will perform the substitution automatically using the following table.

| Operator                 | Automatic replacement                                                |
| ------------------------ | -------------------------------------------------------------------- |
| present                  | not_equal null and not_equal ""                                      |
| blank                    | equal null or equal ""                                               |
| missing                  | equal null                                                           |
| equal                    | in [$value]                                                          |
| not_equal                | not_in [$value]                                                      |
| in                       | equal $value or equal $2 or ...                                      |
| not_in                   | not_equal $value and not_equal $2 and ...                            |
| starts_with              | like '$value%'                                                       |
| ends_with                | like '%$value'                                                       |
| contains                 | like '%$value%'                                                      |
| before                   | less_than $value                                                     |
| after                    | greater_than $value                                                  |
| after_x_hours_ago        | greater_than $hours_ago($value)                                      |
| before_x_hours_ago       | less_than $hours_ago($value)                                         |
| past                     | less_than $now                                                       |
| future                   | greater_than $now                                                    |
| previous_month_to_date   | greater_than $start_of_month & less_than $now                        |
| previous_month           | greater_than $start_of_last_month & less_than $end_of_last_month     |
| previous_quarter_to_date | greater_than $start_of_quarter & less_than $now                      |
| previous_quarter         | greater_than $start_of_last_quarter & less_than $end_of_last_quarter |
| previous_week_to_date    | greater_than $start_of_week & less_than $now                         |
| previous_week            | greater_than $start_of_last_week & less_than $end_of_last_week       |
| previous_x_days_to_date  | greater_than $x_days_ago($value) & less_than $now                    |
| previous_x_days          | greater_than $x_days_ago($value) & less_than $start_of_today         |
| previous_year_to_date    | greater_than $start_of_year & less_than $now                         |
| previous_year            | greater_than $start_of_last_year & less_than $end_of_last_year       |
| today                    | greater_than $start_of_today and less_than $end_of_today             |
| yesterday                | greater_than $start_of_yesterday and less_than $end_of_yesterday     |

In practice:

- if a field supports `equal`, it will automatically support `blank`, `missing` and `in`
- if a field support `less_than`, it will automatically support `before`, `before_x_hours_ago` and `past`
- ... and so on

The minimal list of operators which is sufficient to have them all is the following:

- `in` and `not_in` (unlocks `present`, `blank`, `missing`, `equal` and `not_equal`)
- `less_than` and `greater_than` (unlocks all dates operators)
- `like` (unlocks `starts_with`, `ends_with` and `contains`)
- `not_contains`, `longer_than`, `shorter_than` and `includes_all`

# Paging

A paging clause tells the connector which page of the data should be retrieved.

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

For instance, in `@forestadmin/datasource-sql`, the `searchExtended` flag is used to also search content into all collections which are linked with a `many to one` or `one to one` relation to the current one.

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

## Examples

```json
{ "segment": "Active records" }
```
