Forest Admin is an admin-panel, not a WYSIWYG on top of your database.

As such, to make it user-friendly, it is likely that you will need to bridge the gap between the choices that were made when designing the database powering your app and those which need to be made to design your admin panel.

In order to do that customization which target fields can be achieved with the customization API.

## Admin-panel and Database, how to fill the gap?

When designing databases and APIs, the way to go is usually to push for _normalization_.

This means ensuring there is no redundancy of data (all data is stored in only one place), and that data dependencies are logical.

### Shortcuts & Summaries

When designing an interface the same data may be displayed and editable on multiple parts of an application, depending on the user-need.

- Displaying the `address` of a `Customer` directly in its detail page, instead of needing to browser the `Address` colleciton.
-

### Summaries

Your database may contain the list of all payments which where performed by a customer, however your admin-panel does not need to be limited to that.

- Add new fields on the `Customer` collection which summaries their activity (`medianBasket`, `totalSpend`, `numPurchases`...)
-

# Minimal example

```javascript
collection
  .addField('fullName', {
    type: 'String',
    dependencies: ['firstName', 'lastName'],
    getValues: (records, context) => records.map(r => `${r.firstName} ${r.lastName}`),
  })
  .replaceFieldWriting()
  .emulateFiltering('fullName')
  .emulateSorting('fullName')
  .removeField('firstName', 'lastName');
```
