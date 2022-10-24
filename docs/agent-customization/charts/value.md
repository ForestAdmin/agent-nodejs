![Value chart example](../../assets/chart-value.png)

Value chart simply are charts that display a single value.

```javascript
agent
  // Add a chart to the Dashboard page
  .addChart('monthlyRecuringRevenue', async (context, resultBuilder) => {
    const aggregation = { operation: 'Sum', field: 'amount' };
    const filter = { conditionTree: { field: 'status', operator: 'equal', value: 'paid' } };

    const mrr = await context.dataSource.getCollection('payments').aggregate(filter, aggregation);
    return resultBuilder.value(mrr[0].amount);
  })

  // Add a chart to the Analytics page of the collection "customers"
  .customizerCollection('customers', collection => {
    collection.addChart('monthlyRecuringRevenue', async (context, resultBuilder) => {
      const aggregation = { operation: 'Sum', field: 'amount' };
      const filter = {
        conditionTree: {
          aggregator: 'And',
          conditions: [
            { field: 'status', operator: 'equal', value: 'paid' },
            { field: 'customer:id', operator: 'equal', value: context.recordId },
          ],
        },
      };

      const mrr = await context.dataSource.getCollection('payments').aggregate(filter, aggregation);
      return resultBuilder.value(mrr[0].amount);
    });
  });
```

Optionally, an older value can be provided to the `resultBuilder` to display a growth percentage on the top right of the widget as in the following screenshot:

![Value chart with percentage example](../../assets/chart-value-percentage.png)

```javascript
agent.addChart('appointments', async (context, resultBuilder) => {
  // [...]

  return resultBuilder.value(784, 760);
});
```
