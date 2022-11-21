![Objective chart example](../../assets/chart-objective.png)

Objective charts are very similar to value charts, the only difference being that two numbers should be provided to the `resultBuilder`.

```javascript
agent.addChart('companiesLive', async (context, resultBuilder) => {
  // [...]

  return resultBuilder.objective(235, 300);
});
```
