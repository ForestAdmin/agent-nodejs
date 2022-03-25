- Coding a translation layer
  - Implement a method which, given a forest admin filter and projection retrieve the records
  - Implement a method which, given a forest admin filter and aggregation query, compute the aggregated values
  - When relevant, implement methods for record creation, update and delete.

# Tooling

In order to make your journey easier, a `npm` package which contains tooling is provided: [npmjs://@forestadmin/connector-toolkit](https://www.npmjs.com/package/@forestadmin/connector-toolkit)

It contains:

- All interfaces that you'll be either using or implementing while making your connector
- An implementation of a caching connector, which implements all forest admin features.
- Aggregation, filtering, projection and sorting emulators which can be called from inside your collection
  - This is a perfect match during development
  - It allows to be up and running with all features in minutes (with low performance)
  - You can then translate forest admin concepts one by one, and improve performance gradually
- Decorators which can be loaded on top of your collections to add new behaviors
  - This is a good match to implement features which are not natively supported by the target
  - It allows to bundle reusable behaviors in your connector, that would otherwise need to be added on the configuration of agents by using `customizeCollection`.

Take note that all connectors which are provided by Forest Admin were actually coded using this same toolkit, so you'll be using the same tools as we are.

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

## How high should you aim?

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

## Operator equivalence

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
