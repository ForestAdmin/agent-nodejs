It may happen that you want to create a relationship between two collection, but you don't have a foreign key which is ready to use in order to connect them together.

To solve that use-case, you should use both [computed fields](../fields/computed.md) and relationships.

## Displaying a link to the last message sent by a customer

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
  .customizeCollection('databaseUsers', createFilterableIdentityField)
  .customizeCollection('crmUsers', createFilterableIdentityField)
  .customizeCollection('databaseUsers', createRelationship)
  .customizeCollection('crmUsers', createInverseRelationship);

/**
 * Concatenate firstname, lastname and birthData to make a unique identifier
 * and ensure that the new field is filterable
 */
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

/** Create relationship between databaseUsers and crmUsers */
function createRelationship(databaseUsers) {
  databaseUsers.addOneToOneRelation('userFromCrm', 'crmUsers', {
    originKey: 'userIdentifier',
    originKeyTarget: 'userIdentifier',
  });
}

/** Create relationship between crmUsers and databaseUsers */
function createInverseRelationship(crmUsers) {
  databaseUsers.addManyToOneRelation('userFromDatabase', 'databaseUsers', {
    foreignKey: 'userIdentifier',
    foreignKeyTarget: 'userIdentifier',
  });
}
```
