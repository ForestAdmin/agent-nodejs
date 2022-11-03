![Percentage chart example](../../assets/chart-percentage.png)

Percentage charts are very similar to value charts.

```javascript
agent.addChart('averageVolumeIncrease', async (context, resultBuilder) => {
  // [...]

  return resultBuilder.percentage(11);
});
```
