Your actions may edit records that the user is currently viewing.
This is usually not an issue, as after the successful execution of an action, Forest Admin will reload all data that is displayed on the current page.

This is always true, except for a single case: related data displayed in [custom-built summary views](https://docs.forestadmin.com/user-guide/getting-started/master-your-ui/build-a-summary-view).
In this case, to avoid displaying stale data, you may want to tell the GUI which data has gone stale.

## Example

In the example below, the “Add new transaction” action is accessible from the summary view. This action creates a new transaction and automatically refreshes the “Emitted transactions” related data section to see the new transaction.

![](../../assets/actions-refresh-related.png)

```javascript
agent.customizeCollection('companies', collection =>
  // This action can be triggered from the summary view
  // (see right arrow of the screenshot above)
  collection.addAction('Add new transaction', {
    scope: 'Global',
    execute: async (context, resultBuilder) => {
      /* ... Create new transaction here ... */

      // Tell the GUI to refresh the "emitted_transactions" related data section.
      // (see left arrow of the screenshot above)
      return resultBuilder.success('New transaction emitted', {
        invalidated: ['emitted_transactions'],
      });
    },
  }),
);
```
