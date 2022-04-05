A well-known adage says, "a picture is worth a thousand words": charts help people better understand and remember information.

Forest Admin dashboards are meant to answer that need.

![Dashboard example](../assets/chart-dashboard-on-live-demo.png)

# From your admin panel

Charts can be configured from the interface, without the need to write any code.

This is documented in the [User Guide](https://docs.forestadmin.com/user-guide/dashboards/charts)

# From your agent

Sometimes, charts data are closely tied to your business. Forest Admin allows you to code how the data fueling any given chart is computed.

This is done in three steps:

- Implement the chart from the agent code
- Create a new chart on a Dashboard, and choose "API" as the data source.
- Enter the URL of the chart you just created (`/forest/stats/<chartName>`)

![](../assets/chart-api.png)

Note that, when defining a chart from your agent:

- The type of the chart defined in your agent must match your selection when adding it to a dashboard
- The name of the chart must be URL-safe

## Relation to smart charts

[Smart charts](../frontend-customization/smart-charts/README.md) is a forest admin feature which allow to implement types of charts which are not supported natively (density maps, cohorts, ...).

Coding a chart handler from your agent, in the other hand, give your freedom in how the data powering a native chart is computed.

Both features can be used together, by calling the published URL from a Smart Chart.

## Examples

{% hint style='notice' %}
In the following list of examples, we are making queries using the [Forest Admin Query Interface](../under-the-hood/queries/README.md).

As Forest Admin does not impose any restriction on the handler, you are free to call external APIs, or query your database directly.
{% endhint %}

### Value chart

![Value chart example](../assets/chart-value.png)

```javascript
agent.registerChart('frenchBooks', async (context, responseBuilder) => {
  // Count books which have a french author.
  const rows = await context.dataSource
    .getCollection('books')
    .aggregate(
      { conditionTree: { field: 'author:country:name', operator: 'equal', value: 'France' } },
      { operation: 'Count' },
    );

  return responseBuilder.value(rows[0].value);
});
```

### Objective chart

![Objective chart example](../assets/chart-objective.png)

Objective charts are very similar to value charts, the only difference being that two numbers should be provided to the `responseBuilder`

```javascript
agent.registerChart('frenchBooksObjective', async (context, responseBuilder) => {
  // [...]

  return responseBuilder.objective(rows[0].value, 250);
});
```

### Repartition chart

![Repartition chart example](../assets/chart-repartition.png)

Repartition charts should return a plain object in the form

```json
{ "France": 32, "Spain": 23, "Portugal": 45 }
```

```javascript
agent.registerChart('booksByAuthorCountry', async (context, responseBuilder) => {
  // Count books by their author's country
  const rows = await context.dataSource
    .getCollection('books')
    .aggregate({}, { operation: 'Count', groups: [{ field: 'author:country:name' }] });

  // Make plain object
  const obj = {};
  for (const row of rows) {
    obj[row.group['author:country:name']] = row.value;
  }

  return responseBuilder.repartition(obj);
});
```

### Time-based

![Time chart example](../assets/chart-time.png)

Time-based charts are very similar to repartition charts, the only difference being that the keys of the provided object must be ISO-8601 compliant dates

```json
{
  "1955-11-05T01:22:00-08:00": 45,
  "1985-10-26T01:22:00-08:00": 32,
  "2015-10-21T01:22:00-08:00": 23
}
```

```javascript
agent.registerChart('numBooksByReleaseMonth', async (context, responseBuilder) => {
  // Count books by release month
  const rows = await context.dataSource
    .getCollection('books')
    .aggregate({}, { operation: 'Count', groups: [{ field: 'releaseDate', operation: 'Month' }] });

  // Make plain object
  const obj = {};
  for (const row of rows) {
    obj[row.group['releaseDate']] = row.value;
  }

  return responseBuilder.time(obj);
});
```
