A filter represents a subset of records _within a collection_.

As such, a filter always exists on the context of a given collection.

It is used to restrict the records which will be targeted by specific actions (list, update, aggregate, ...)

```json
{
  // Select records matching both the conditionTree, search and segment settings
  "conditionTree": {
    "aggregator": "and",
    "conditions": [
      { "field": "title", "operator": "like", "value": "found%" },
      { "not": { "field": "createdAt", "operator": "today" } }
    ]
  },
  "search": "John Smith",
  "searchExtended": false,
  "segment": "Active Records",

  // Keep only first 30 records, according to the sort clause
  "page": { "limit": 30, "skip": 0 },
  "sort": [
    { "field": "title", "ascending": true },
    { "field": "id", "ascending": true }
  ],

  // The browser's timezone is always provided (needed to evaluate some conditions on dates)
  "timezone": "Europe/Paris"
}
```

# Understanding condition trees

Each node of a condition tree can be one of four things:

- A "Not" branch: `{ not: <otherNode> }`
- An "And" branch: `{ aggregator: 'or', conditions: [<otherNodes>] }`
- An "Or" branch: `{ aggregator: 'or', conditions: [<otherNodes>] }`
- A "condition" leaf: `{ field: 'title', operator: 'equal', value: 'Foundation' }`

## Operators

Many operators

// All types
Present = 'present',
Blank = 'blank',
Missing = 'missing',

// All types besides arrays
Equal = 'equal',
NotEqual = 'not_equal',
LessThan = 'less_than',
GreaterThan = 'greater_than',
In = 'in',
NotIn = 'not_in',

// Strings
Like = 'like',
StartsWith = 'starts_with',
EndsWith = 'ends_with',
Contains = 'contains',
NotContains = 'not_contains',
LongerThan = 'longer_than',
ShorterThan = 'shorter_than',

// Dates
Before = 'before',
After = 'after',
AfterXHoursAgo = 'after_x_hours_ago',
BeforeXHoursAgo = 'before_x_hours_ago',
Future = 'future',
Past = 'past',
PreviousMonthToDate = 'previous_month_to_date',
PreviousMonth = 'previous_month',
PreviousQuarterToDate = 'previous_quarter_to_date',
PreviousQuarter = 'previous_quarter',
PreviousWeekToDate = 'previous_week_to_date',
PreviousWeek = 'previous_week',
PreviousXDaysToDate = 'previous_x_days_to_date',
PreviousXDays = 'previous_x_days',
PreviousYearToDate = 'previous_year_to_date',
PreviousYear = 'previous_year',
Today = 'today',
Yesterday = 'yesterday',

// Arrays
IncludesAll = 'includes_all',

## Relations

Tests in a condition tree can target

- Any field in the targeted collection
- Any field in many to one or one to one relationships

It should not noted that fields in one to many and many to many relationships **cannot** be targeted.

# Examples

Given the following collections, let's look at the following condition trees

Valid conditions trees:

- `{ field: 'title', operator: 'starts_with', value: 'Found' }`
- `{ field: 'author:firstName', operator: 'equal', value: 'Isaac' }`
- `{ aggregator: 'and', conditions: [ { field: 'title', operator: 'not_equal', value: 'Foundation'} ] }`

Invalid condition trees:

- `{ field: 'reviews:}
