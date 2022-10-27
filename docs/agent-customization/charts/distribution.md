![Distribution chart example](../../assets/chart-distribution.png)

Distribution charts should return a plain object.

```javascript
agent.addChart('booksByAuthorCountry', async (context, resultBuilder) => {
  // [...]

  return resultBuilder.distribution({
    validated: 100,
    rejected: 100,
    to_validate: 100,
  });
});
```
