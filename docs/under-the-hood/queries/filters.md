A filter represents a subset of records _within a collection_.
As such, a filter always exists on the context of a given collection.

It is used to restrict the records which will be targeted by specific actions (list, update, aggregate, ...)

```json
{
  // Condition tree
  "conditionTree": { "field": "createdAt", "operator": "today" },

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

### Simple condition tree

```json
{ "field": "title", "operator": "starts_with", "value": "Found" }
```

### With multiple conditions

```json
{
  "aggregator": "and",
  "conditions": [
    { "field": "title", "operator": "Equal", "value": "Foundation" },
    { "field": "subTitle", "operator": "Equal", "value": "The Psychohistorians" }
  ]
}
```

### With relations

It also supports relations, the `one to one` and the `many to one` is supported.

In this example, we want to apply a condition tree on a relation field value.

```json
{ "field": "book:title", "operator": "Equal", "value": "Foundation" },
```

Of course, we chain as many relations as you like.

```json
{ "field": "book:price:value", "operator": "Equal", "value": "15" }
```

## Structure

Each node of a condition tree can be one of five things:

- An "And" branch: `{ aggregator: 'And', conditions: [<otherNodes>] }`
- An "Or" branch: `{ aggregator: 'Or', conditions: [<otherNodes>] }`
- A "condition" leaf without parameter: `{ field: 'title', operator: 'Present' }`
- A "condition" leaf with parameter: `{ field: 'title', operator: 'Equal', value: 'Foundation' }`

## Operators

Here is the list of operators which are supported by forest admin.

| Operator              | Types         | Expected parameter  |
| --------------------- | ------------- | ------------------- |
| Present               | All           | ∅                   |
| Blank                 | All           | ∅                   |
| Missing               | All           | ∅                   |
| Equal                 | All but array | Field type          |
| NotEqual              | All but array | Field type          |
| LessThan              | All but array | Field type          |
| GreaterThan           | All but array | Field type          |
| In                    | All but array | Array of field type |
| NotIn                 | All but array | Array of field type |
| Like                  | String        | String              |
| StartsWith            | String        | String              |
| EndsWith              | String        | String              |
| Contains              | String        | String              |
| NotContains           | String        | String              |
| LongerThan            | String        | Number              |
| ShorterThan           | String        | Number              |
| Before                | Date          | Date                |
| After                 | Date          | Date                |
| AfterXHoursAgo        | Date          | Number              |
| BeforeXHoursAgo       | Date          | Number              |
| Past                  | Date          | ∅                   |
| Future                | Date          | ∅                   |
| PreviousMonthToDate   | Date          | ∅                   |
| PreviousMonth         | Date          | ∅                   |
| PreviousQuarterToDate | Date          | ∅                   |
| PreviousQuarter       | Date          | ∅                   |
| PreviousWeekToDate    | Date          | ∅                   |
| PreviousWeek          | Date          | ∅                   |
| PreviousXDaysToDate   | Date          | Number              |
| PreviousXDays         | Date          | Number              |
| PreviousYearToDate    | Date          | ∅                   |
| PreviousYear          | Date          | ∅                   |
| Today                 | Date          | ∅                   |
| Yesterday             | Date          | ∅                   |
| IncludesAll           | Array         | Array               |

## Operator equivalence

You may have noticed that many operators overlap. In order to make data sources quicker to implement, forest admin supports automatic operator replacement.

What that means, is that when an operator can be expressed using a combination of other operators, forest admin will perform the substitution automatically using the following table.

| Operator              | Automatic replacement                                        |
| --------------------- | ------------------------------------------------------------ |
| Present               | NotEqual null and NotEqual ""                                |
| Blank                 | Equal null or Equal ""                                       |
| Missing               | Equal null                                                   |
| Equal                 | In [$value]                                                  |
| NotEqual              | NotIn [$value]                                               |
| In                    | Equal $value or Equal $2 or ...                              |
| NotIn                 | NotEqual $value and NotEqual $2 and ...                      |
| StartsWith            | Like '$value%'                                               |
| EndsWith              | Like '%$value'                                               |
| Contains              | Like '%$value%'                                              |
| Before                | LessThan $value                                              |
| After                 | GreaterThan $value                                           |
| AfterXHoursAgo        | GreaterThan $hoursAgo($value)                                |
| BeforeXHoursAgo       | LessThan $hoursAgo($value)                                   |
| Past                  | LessThan $now                                                |
| Future                | GreaterThan $now                                             |
| PreviousMonthToDate   | GreaterThan $startOfMonth & LessThan $now                    |
| PreviousMonth         | GreaterThan $startOfLastMonth & LessThan $endOfLastMonth     |
| PreviousQuarterToDate | GreaterThan $startOfQuarter & LessThan $now                  |
| PreviousQuarter       | GreaterThan $startOfLastQuarter & LessThan $endOfLastQuarter |
| PreviousWeekToDate    | GreaterThan $startOfWeek & LessThan $now                     |
| PreviousWeek          | GreaterThan $startOfLastWeek & LessThan $endOfLastWeek       |
| PreviousXDaysToDate   | GreaterThan $xDaysAgo($value) & LessThan $now                |
| PreviousXDays         | GreaterThan $xDaysAgo($value) & LessThan $startOfToday       |
| PreviousYearToDate    | GreaterThan $startOfYear & LessThan $now                     |
| PreviousYear          | GreaterThan $startOfLastYear & LessThan $endOfLastYear       |
| Today                 | GreaterThan $startOfToday and LessThan $endOfToday           |
| Yesterday             | GreaterThan $startOfYesterday and LessThan $endOfYesterday   |

In practice:

- if a field supports `Equal`, it will automatically support `Blank`, `Missing` and `In`
- if a field support `LessThan`, it will automatically support `Before`, `BeforeXHoursAgo` and `Past`
- ... and so on

The minimal list of operators which is sufficient to have them all is the following:

- `In` and `NotIn` (unlocks `Present`, `Blank`, `Missing`, `Equal` and `NotEqual`)
- `LessThan` and `GreaterThan` (unlocks all dates operators)
- `Like` (unlocks `StartsWith`, `EndsWith` and `Contains`)
- `NotContains`, `LongerThan`, `ShorterThan` and `IncludesAll`

# Paging

A paging clause tells the data source which page of the data should be retrieved.

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

Likewise `searchExtended` boolean is an action which can be triggered by end-users when a given search returns no results and its implementation can vary between data sources.

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
