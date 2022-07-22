Forest Admin allows to create new fields on any collection, either computationally, by fetching data on an external API, or based on other data that is available on the connected data sources.

By default, the fields that you create will be readonly, but you can make them [filterable](./filter.md), [sortable](./sort.md) and [writable](./write.md) by using the relevant methods.

## How does it works

When creating new field you will need to provide:

| Field                 | Description                                                                                                                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| columnType            | Type of the new field which can be [any primitive](../../under-the-hood/data-model/typing.md#primitive-types) or [composite type](../../under-the-hood/data-model/typing.md#composite-types) |
| dependencies          | List of fields that you need from the source records and linked records in order to run the handler                                                                                          |
| getValues             | Handler which computes the new value **for a batch of records**                                                                                                                              |
| enumValues (optional) | When columnType is `Enum`, you must specify the values that the field will support                                                                                                           |

## Examples

### Adding a field by concatening other fields

This examples add a `user.displayName` field, which is computed by concatenating the first and last name.

```javascript
// User collection has the following structure: { id, firstName, lastName }
agent.customizeCollection('user', collection => {
  collection.addField('displayName', {
    // Type of the new field
    type: 'String',

    // Dependencies which are needed to compute the new field (must not be empty)
    dependencies: ['firstName', 'lastName'],

    // Compute function for the new field
    // Note that the function computes the new values in batches: the return value must be
    // an array which contains the new values in the same order than the provided records.
    getValues: (records, context) => records.map(r => `${r.firstName} ${r.lastName}`),
  });
});
```

### Adding a field which depend on a many to one relation

We can improve the previous example by adding the city of the user in the display name.

```javascript
// Structure:
// User    { id, addressId, firstName, lastName }
// Address { id, city }

agent.customizeCollection('user', collection => {
  collection.addField('displayName', {
    type: 'String',

    // We added 'address:city' in the list of dependencies,
    // which tells forest to fetch the related record
    dependencies: ['firstName', 'lastName', 'address:city'],

    // The address is now available in the parameters
    getValues: (records, context) =>
      records.map(r => `${r.firstName} ${r.lastName} (from ${r.address.city})`),
  });
});
```

### Adding a field which depend on one to many relation

Let's now add a `user.totalSpending` field by summing the amount of all `orders`

```javascript
// Structure
// User  { id }
// Order { id, customerId, amount }

agent.customizeCollection('user', collection => {
  collection.addField('totalSpending', {
    type: 'Number',
    dependencies: ['id'],
    getValues: async (records, context) => {
      const recordIds = records.map(r => r.id);

      // We're using Forest Admin's query interface (you can use an ORM or a plain SQL query)
      const filter = { conditionTree: { field: 'customer_id', operator: 'In', value: recordIds } };
      const aggregation = { operation: 'Sum', field: 'amount', groups: [{ field: 'customer_id' }] };
      const rows = await context.dataSource.getCollection('order').aggregate(filter);

      return records.map(record => {
        const row = rows.find(r => r.group.customer_id === record.id);
        return row?.value ?? 0;
      });
    },
  });
});
```

### Adding a field fetching data from an API

Let's imagine that we want to check if the email address of our users are deliverable.
We can use a verification API to perform that work.

```javascript
// Fictional verification API.
const emailVerificationClient = require('@sendchimplio/client');
client.setApiKey(process.env.SENDCHIMPLIO_API_KEY);

// User collection has the following structure: { id, email }
agent.customizeCollection('user', collection => {
  collection.addField('emailDeliverable', {
    type: 'Boolean',
    dependencies: ['email'],
    getValues: async (records, context) => {
      // Structure of the response is
      // {
      //  'adress1@domain.com': { usernameChecked: false, usernameValid: null, domainValid: true },
      //  'adress2@domain.com': { usernameChecked: true, usernameValid: true, domainValid: true },
      //  'adress3@domain.com': { usernameChecked: true, usernameValid: true, domainValid: true },
      // }
      const response = await emailVerificationClient.verifyEmails(records.map(r => r.email));

      // Always return values in the same order than the source records
      return records.map(r => {
        const check = response[r.email];
        return check.domainValid && (!usernameChecked || usernameValid);
      });
    },
  });
});
```

## Performance

When adding many fields, keep in mind that:

- You should refrain from making queries to external services for each record
  - Use relationships in the dependency array when that is possible
  - Otherwise, try to use batch APIs instead of performing queries inside of the `records.map()` handler.
- Only add fields you need in the `dependencies` list
  - This will reduce the pressure on your datasources (less columns to fetch)
  - And increase the probability of reducing the number of records that will be passed to your handler (records are deduplicated).
- Do not duplicate code between handlers of different fields: fields can depend on each others (no cycles allowed).
