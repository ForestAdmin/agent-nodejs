![Time chart example](../../assets/chart-time.png)

Time-based charts are very similar to distribution charts, the only differences being that:

- An additional parameter tells the frontend if the dates should be displayed by `Day`, `Week`, `Month`, or `Year`.
- The keys of the provided object must be ISO-8601 compliant dates.

```javascript
agent.addChart('transactionVolume', async (context, resultBuilder) => {
  // [...]

  return resultBuilder.timeBased('Month', {
    '2017-02-01': 636,
    '2017-03-01': 740,
    '2017-04-01': 648,
    '2017-05-01': 726,
    // [...]
  });
});
```
