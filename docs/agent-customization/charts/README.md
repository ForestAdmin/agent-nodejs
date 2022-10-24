A well-known adage says, "a picture is worth a thousand words": charts help people better understand and remember information.

Forest Admin dashboards and analytics are meant to answer that need.

![Dashboard example](../../assets/chart-dashboard-on-live-demo.png)

# From your admin panel

Charts can be configured from the interface, without the need to write any code.

This is documented in the [User Guide](https://docs.forestadmin.com/user-guide/dashboards/charts)

# From your agent

Sometimes, charts data are closely tied to your business. Forest Admin allows you to code how the data fueling any given chart is computed.

This is done in three steps:

- Implement the chart from the agent code.
- Either
  - Create a new chart on a _Dashboard_, and choose "API" as the data source.
  - Or create a new chart in the _Analytics_ tab of a collection.
- Enter the URL of the chart you just created (`/forest/_charts/<chartName>` or `/forest/_charts/<collectionName>/<chartName>`).

![](../../assets/chart-api.png)

Note that, when defining a chart from your agent:

- The type of the chart defined in your agent must match your selection when adding it to a dashboard or record.
- The name of the chart must be URL-safe.

## Relation to smart charts

[Smart charts](../../frontend-customization/smart-charts/README.md) is a forest admin feature which allow to implement types of charts which are not supported natively (density maps, cohorts, ...).

Coding a chart handler from your agent, in the other hand, give your freedom in how the data powering a native chart is computed.
