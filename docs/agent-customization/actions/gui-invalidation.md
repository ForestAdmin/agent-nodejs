
## Refreshing data on the summary view

If you want to create an action accessible from the details or the summary view of a record involving related data, this section may interest you.

In the example below, the “Add new transaction” action is accessible from the summary view. This action creates a new transaction and automatically refreshes the “Emitted transactions” related data section to see the new transaction.

```javascript
return resultBuilder.success('New transaction emitted', {
  invalidated: ['emitted_transactions'],
});
```

![](../../assets/actions-refresh-related.png)
