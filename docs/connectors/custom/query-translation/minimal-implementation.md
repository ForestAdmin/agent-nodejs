Before starting, note that

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

# Emulation

There is no emulation for connector defined segments, as that feature can be safely ignored without any impact on the final admin panel functionalities.

---

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

---

If the datasource you are targeting supports the `equal` and `contains` operators on at least some fields, the search bar will be displayed.

Using it will add conditions to the condition tree.

---

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

# Filters
