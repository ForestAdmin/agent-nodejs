You may want to create a relationship between two collections, but you don't have a foreign key that is ready to use to connect them.

To solve that use case, you should use both [computed fields](../fields/computed.md) and relationships.

This is done with the following steps:

- Create a new field containing a foreign key.
- Make the field filterable for the `In` operator (see [Under the hood](./under-the-hood.md) as to why this is required).
- Create a relation using it.

## Displaying a link to the last message sent by a customer

We have two collections: `Customers` and `Messages` which are linked together by a `one-to-many` relationship.

We want to create a `ManyToOne` relationship with the last message sent by a given customer.

```javascript
agent.customizeCollection('customers', collection => {
  // Create foreign key
  collection.addField('lastMessageId', {
    columnType: 'Number',
    dependencies: ['id'],
    getValues: async (customers, context) => {
      // We're using Forest Admin's query interface (you can use an ORM or a plain SQL query)
      const messages = context.dataSource.getCollection('messages');
      const conditionTree = {
        field: 'customer_id',
        operator: 'In',
        value: customers.map(r => r.id),
      };
      const rows = await messages.aggregate(
        { conditionTree },
        { operation: 'Max', field: 'id', groups: [{ field: 'customer_id' }] },
      );

      return customers.map(record => {
        return rows.find(row => row.group.customer_id === record.id)?.value ?? null;
      });
    },
  });

  // Implement the 'In' operator.
  collection.replaceFieldOperator('lastMessageId', 'In', async (lastMessageIds, context) => {
    const records = await context.dataSource
      .getCollection('messages')
      .list({ conditionTree: { field: 'id', operator: 'In', value: lastMessageIds } }, [
        'customer_id',
      ]);

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

There is no common id between them that can be used to tell Forest Admin how to link them together, however, both collections have `firstName`, `lastName`, and `birthDate` fields, which taken together, are unique enough.

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
    columnType: 'String',
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
  crmUsers.addManyToOneRelation('userFromDatabase', 'databaseUsers', {
    foreignKey: 'userIdentifier',
    foreignKeyTarget: 'userIdentifier',
  });
}
```
