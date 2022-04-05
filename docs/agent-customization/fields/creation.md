# Adding fields

Forest Admin allows to create new fields on any collection, either computationally, by fetching data on an external API, or based on other data that is available on the connected data sources.

## Example: Customizing your "customers" collection

In this first example, we want to display the customer's city in the table-view.

However, as there is no "city" column on the "customer" database table, we need to retrieve it from the "address" relation.

```javascript
agent.customizeCollection('customers', collection =>
  collection.importField('city', { path: 'address:city', readonly: true }),
);
```

Adding our city column into the table does bring functionality, but it created complexity.

Let's reduce the number of columns in the table-view by merging three columns into one and hiding the extra columns in the admin panel

```javascript
agent.customizeCollection('customers', collection =>
  collection.registerField('displayName', {
    type: 'String',
    dependencies: ['firstName', 'lastName', 'address:city'],
    getValues: (records, context) =>
      records.map(r => `${r.firstName} ${r.lastName} (from ${r.address.city})`),

    // Optional configuration
    filterBy: 'emulate', // Use emulation only on segments or small collections.
    sortBy: [
      { field: 'firstName', ascending: true },
      { field: 'lastName', ascending: true },
      { field: 'address:city', ascending: true },
    ],
  }),
);
```

A convenient next step would be to display the total spending of customers of our e-commerce website while browsing through them.

```javascript
agent.customizeCollection('customers', collection =>
  collection.registerField('totalSpending', {
    type: 'Number',
    dependencies: ['id'],
    getValues: (records, context) => {
      const recordIds = records.map(r => r.id);
      const filter = { conditionTree: { field: 'customer_id', operator: 'in', value: recordIds } };
      const aggregation = { operation: 'Sum', field: 'amount', groups: [{ field: 'customer_id' }] };
      const rows = await context.dataSource.getCollection('orders').aggregate(filter);

      return records.map(record => {
        const row = rows.find(r => r.group.customer_id === record.id);
        return row?.value ?? 0;
      });
    },
  }),
);
```

## Take-aways

| Notice that                                                                                   | Take-away                                                                   |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| The [typing system](../under-the-hood/data-model/typing.md) is the same than for other fields | Any type can be used including Composite types                              |
| Dependencies are explicitly defined and can target relations                                  | Need to perform queries in the handler for many use-cases                   |
| "filterBy" contains 'emulate' while "sortBy" contains an equivalent sort clause               | Dynamically created fields can be made filterable and sortable              |
| The handler is an async function                                                              | Calling a database or other async APIs will work out of the box             |
| The handler works with a batch of records                                                     | Each field cost at most one extra database request (and not one per record) |
