API charts in the legacy agents were declared using express routes.

In the new agent, you will need to use either the `agent.addChart` or the `collection.addChart` function, depending on if the chart is to be displayed on a record of a collection or a dashboard.

# Code cheatsheet

| Legacy agent             | New agent                                                                 |
| ------------------------ | ------------------------------------------------------------------------- |
| router.post              | agent.addChart<br>collection.addChart(...)                                |
| Liana.StatSerializer     | return resultBuilder.value(...)<br>return resultBuilder.distribution(...) |
| request.query?.record_id | context.recordId                                                          |

# How to migrate ([docs](../../../agent-customization/charts/README.md))

Migrating should be straightforward: the only difference are that:

- dashboard charts are now declared using the `agent.addChart` function.
- collection charts are now declared using the `collection.addChart` function, and access the record id using `context.recordId` instead of `request.query?.record_id`.
- Both types should use the `resultBuilder` helper to return the chart data.

{% tabs %} {% tab title="Before" %}

```javascript
router.post('/stats/mrr', (req, res) => {
  // Load data
  const from = moment.utc('2018-03-01').unix();
  const to = moment.utc('2018-03-31').unix();
  const charges = await stripe.charges.list({ created: { gte: from, lte: to } });

  // Compute chart
  const mrr = charges.reduce((acc, charge) => acc + charge.amount, 0);
  const json = new Liana.StatSerializer({value: mrr}).perform();

  res.send(json);
});
```

{% endtab %} {% tab title="After" %}

```javascript
agent.addChart('monthlyRecuringRevenue', async (context, resultBuilder) => {
  // Load data
  const from = moment.utc('2018-03-01').unix();
  const to = moment.utc('2018-03-31').unix();
  const charges = await stripe.charges.list({ created: { gte: from, lte: to } });

  // Compute chart
  const mrr = charges.reduce((acc, charge) => acc + charge.amount, 0);

  return resultBuilder.value(mrr);
});
```

{% endtab %} {% endtabs %}
