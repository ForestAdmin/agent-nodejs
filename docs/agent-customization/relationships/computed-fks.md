It may happen that you want to create a relationship between two collection, but you don't have a foreign key which is ready to use in order to connect them together.

To solve that use-case, during the customization process, you can combine the use of [computed fields](../fields/computed.md) and relationships.

## Displaying the last message of a customer as a Many-to-One relationship

We have two collections: `Customers` and `Messages` which are linked together by a `OneToMany` relationships.

We want to create a `ManyToOne` relationship to the last message sent by a given customer.

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
      // We're using Forest Admin's query interface (you can use an ORM or a plain SQL query)
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

  // Implement the 'In' operator (required).
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

## Connecting collections without having a shared identifier

You have two collections which both contain users: one comes from your database, and the other one is connected to the CRM that your company uses.

There is no common id between them that can be used to tell Forest Admin how to link them together, however both collection have `firstName`, `lastName` and `birthDate` fields, which taken together, are unique enough.

```javascript
agent
  // Concatenate firstname and last name to make a unique identifier on both sides
  .customizeCollection('databaseUsers', createFilterableIdentityField)
  .customizeCollection('crmUsers', createFilterableIdentityField)

  // Create relationships using the foreign key we just added
  .customizeCollection('databaseUsers', collection => {
    collection.addManyToOneRelation('userFromCrm', 'crmUsers', {
      foreignKey: 'userIdentifier',
      foreignKeyTarget: 'userIdentifier',
    });
  });

function createFilterableIdentityField(collection) {
  // Create foreign key on the collection from the database
  collection.addField('userIdentifier', {
    beforeJointures: true, // Ensure this field is accesible for the jointure
    dependencies: ['firstName', 'lastName', 'birthDate'],
    getValues: user => user.map(u => `${u.firstName}/${u.lastName}/${u.birthDate}`),
  });

  // Implement 'In' filtering operator (required)
  collection.replaceFieldOperator('userIdentifier', 'In', values => ({
    aggregator: 'Or',
    conditions: values.map(value => ({
      aggregator: 'And',
      conditions: [
        { field: 'firstName', operator: 'Equal', value: value.split('/')[0] },
        { field: 'lastName', operator: 'Equal', value: value.split('/')[1] },
        { field: 'birthDate', operator: 'Equal', value: value.split('/')[2] },
      ],
    })),
  }));
}
```
