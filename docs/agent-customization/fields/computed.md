Forest Admin allows to create new fields on any collection, either computationally, by fetching data on an external API, or based on other data that is available on the connected data sources.

## Example: Customizing your "customers" collection

In this first example, we want to display the customer's city in the table-view.

However, as there is no "city" column on the "customer" database table, we need to retrieve it from the "address" relation.

```javascript
collection.importField('city', { path: 'address:city', readonly: true });
```

Adding our city column into the table does bring functionality, but it created complexity.

Let's reduce the number of columns in the table-view by merging three columns into one and hiding the extra columns in the admin panel

```javascript
collection.addField('displayName', {
  type: 'String',
  dependencies: ['firstName', 'lastName', 'address:city'],
  getValues: (records, context) =>
    records.map(r => `${r.firstName} ${r.lastName} (from ${r.address.city})`),
});
```

A convenient next step would be to display the total spending of customers of our e-commerce website while browsing through them.

```javascript
collection.addField('totalSpending', {
  type: 'Number',
  dependencies: ['id'],
  getValues: async (records, context) => {
    const recordIds = records.map(r => r.id);
    const filter = { conditionTree: { field: 'customer_id', operator: 'In', value: recordIds } };
    const aggregation = { operation: 'Sum', field: 'amount', groups: [{ field: 'customer_id' }] };
    const rows = await context.dataSource.getCollection('orders').aggregate(filter);

    return records.map(record => {
      const row = rows.find(r => r.group.customer_id === record.id);
      return row?.value ?? 0;
    });
  },
});
```
## Make it writable

When you add a field, it is not writable. To allow it, use the `replaceFieldWriting` method.

```javascript
collection.replaceFieldWriting('fullName', (value) => {
  const [firstName, lastName] = value.split(' ');
  return { firstName, lastName };
});
```
