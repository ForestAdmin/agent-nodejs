When plugging a new data source, relationships will work out of the box, however you may want to add additional relations for user convenience.

Let's imagine that we have two collections: `Customers` and `Messages`.

Both collections are linked together by a `OneToMany` relationships, however, users of the admin panel only care about the last message sent by a user.

Therefor, we can create a `ManyToOne` relationship between `Customer` and `Messages`.

This is done in two steps:

- Create a new field containing a foreign key.
- Create a relation using it.

```javascript
agent.customizeCollection('customers', collection => {
  // Create foreign key
  collection.addField('lastMessageId', {
    beforeJointures: true, // Ensure this field is accesible for the jointure
    dependencies: ['id'],
    getValues: async (customers, context) => {
      const messages = context.dataSource.getCollection('messages');
      const rows = await messages.aggregate(
        { field: 'customer_id', operator: 'In', value: customers.map(r => r.id) },
        { operator: 'Max', field: 'id', groups: [{ field: 'customer_id' }] },
      );

      return customers.map(record => {
        return rows.find(row => row.group.customer_id === record.id)?.value ?? null;
      });
    },
  });

  // Implement the 'In' operator (used by the relation).
  collection.replaceFieldOperator('lastMessageId', 'In', async (lastMessageIds, context) => {
    const records = await context.dataSource
      .getCollection('messages')
      .list({ field: 'id', operator: 'In', value: lastMessageIds }, ['customer_id']);

    return { field: 'id', operator: 'In', value: records.map(r => r.customer_id) };
  });

  // Create relationships using the foreign key we just added.
  collection.addManyToOneRelation('lastMessage', 'messages', {
    foreignKey: 'lastMessageId',
  });
});
```
