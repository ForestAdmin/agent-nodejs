![Leaderboard chart example](../../assets/chart-leaderboard.png)

Leaderboard chart display a list of records sorted by their value.

```javascript
agent.addChart('companiesLive', async (context, resultBuilder) => {
  // [...]

  return resultBuilder.leaderboard({
    Bonanza: 5835694,
    TalkSpace: 4179218,
    Tesco: 3959931,
    BitPesa: 3856685,
    Octiv: 3747458,
  });
});
```
