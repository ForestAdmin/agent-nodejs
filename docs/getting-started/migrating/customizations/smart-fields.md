In legacy agents declaring a smart field was done in one big step.

In the new agent, the process was split into multiple steps, depending on the capabilities of the field (writing, filtering, sorting, etc.).

This was done to reduce the complexity of the code and to make it easier to understand, but also because it allows customers to reuse the same API when customizing the behavior of normal fields, and thus reduce the API surface that you need to learn.

# Code cheatsheet

| Legacy agent                              | New agent                                                                              |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| get: (record) => { ... }                  | getValues: (records) => { ... }                                                        |
| set: (record, value) => { ... }           | .replaceFieldWriting(...)                                                              |
| filter: ({ condition, where }) => { ... } | .replaceFieldOperator(...)<br>.emulateFieldOperator(...)<br>emulateFieldFiltering(...) |
| type: 'String'                            | columnType: 'String'                                                                   |
| enums: ['foo', 'bar']                     | columnType: 'Enum', enumValues: ['foo', 'bar']                                         |
| reference: 'otherCollection.id'           | [Use a smart relationship](./smart-relationships.md)                                   |

# Do you still need a computed field?

Smart fields were a powerful tool, but they were also a performance bottleneck.

In the new agent, we have introduced two new concepts that can replace many of the use cases of smart fields:

If you were using a smart field to move a field from one collection to another or to create a link to another record in the UI, you can likely use one of these much simpler solutions.

- [Moving fields](../../../agent-customization/fields/import-rename-delete.md#moving-fields)
- [Relationships](../../../agent-customization/relationships/README.md)

# Steps

## Step 1: Implement a read-only version of the field ([Docs](../../../agent-customization/fields/computed.md))

Computed fields in the new agent are declared by calling the `addField` function on the appropriate collection.

Many changes have been made to the API.

### Dependencies are explicit

You will notice that a new `dependencies` property is required when declaring a computed field.

It is an array of field names that tells forest admin which fields the `getValues()` function depends on: Unlike the legacy agent, the new agent will not automatically fetch the whole record.

You can [fetch data from relations](../../../agent-customization/fields/computed.md#adding-a-field-that-depends-on-a-many-to-one-relationship) and [fetch data from other computed fields](../../../agent-customization/fields/computed.md#adding-a-field-that-depends-on-another-computed-field).

### Fields now work in batches

Even if it adds some complexity, exposing a batch API to our customers is a much better solution for performance.

The `get` function is now called `getValues`: it no longer takes a single record as its first argument, but an array of records, and must return an array of values, one for each record, in the same order.

### Other changes

There are other minor changes to the API:

- the `type` property was renamed to `columnType`.
- The `field` property no longer exists. The field name is now the first argument of the `addField` function.
- The `reference` property no longer exists: use the [smart relationships guide](./smart-relationships.md).
- The `enums` property was renamed to `enumValues`.

### Example

In the following example, we will port a field that fetches the full address of a user from a third-party service.

When displaying a list of records, the new agent will only make one call to the API, and then display the results for all records, instead of making one call per record.

{% tabs %} {% tab title="Before" %}

```javascript
collection('users', {
  fields: [
    {
      field: 'full_address',
      type: 'String',
      get: async user => {
        const address = await geoWebService.getAddress(customer.address_id);

        return [
          address.address_line_1,
          address.address_line_2,
          address.address_city,
          address.country,
        ].join('\n');
      },
    },
  ],
});
```

{% endtab %} {% tab title="After" %}

```javascript
agent.customizeCollection('users', users => {
  users.addField('full_address', {
    columnType: 'String',
    dependencies: ['address_id'],
    getValues: async users => {
      const addresses = await geoWebService.getAddresses(users.map(user => user.address_id));

      return users.map(user => {
        const address = addresses.find(address => address.id === user.address_id);

        return [
          address.address_line_1,
          address.address_line_2,
          address.address_city,
          address.country,
        ].join('\n');
      });
    },
  });
});
```

{% endtab %} {% endtabs %}

## Step 2: Implement write handler ([Docs](../../../agent-customization/fields/write.md))

If you want your computed field to be writable, you will need to call the `.replaceFieldWriting()` function.

This part is very similar to the legacy agent. The API change is because this function can be used to make any field writable, not just computed fields, or to change the default writing behavior of a normal field.

{% tabs %} {% tab title="Before" %}

```javascript
collection('users', {
  fields: [
    {
      field: 'full_address',
      type: 'String',
      get: /* ... same as before ... */,
      set: async (user, value) => {
        const address = await geoWebService.getAddress(customer.address_id);

        address.address_line_1 = value.split('\n')[0];
        address.address_line_2 = value.split('\n')[1];
        address.address_city = value.split('\n')[2];
        address.country = value.split('\n')[3];

        await geoWebService.updateAddress(address);
      },
    },
  ],
});
```

{% endtab %} {% tab title="After" %}

```javascript
agent.customizeCollection('users', users => {
  users
    .addField('full_address', { /* ... same as before ... */ })
    .replaceFieldWriting('full_address', (value, context) => {
      const address = await geoWebService.getAddress(customer.address_id);

      address.address_line_1 = value.split('\n')[0];
      address.address_line_2 = value.split('\n')[1];
      address.address_city = value.split('\n')[2];
      address.country = value.split('\n')[3];

      await geoWebService.updateAddress(address);

      // You can optionally return a hash of attributes to update
      // Updating relations is also supported (see relevant guide)
      return {};
    });
});
```

{% endtab %} {% endtabs %}

## Step 3: Implement the filters you use ([Docs](../../../agent-customization/fields/filter.md))

### Structure

Implementing filters in the new agent is done operator by operator, instead of using a single function.

This allows more fine-grained control over the behavior of each operator and makes it possible to implement only the operators you need.

Also note that unlike in the legacy agent, [automatic operator replacement](../../../under-the-hood/queries/filters.md#operator-equivalence) will be performed by the agent, so the number of operators that you need to implement to unlock all filtering is much lower.

### Return value

Because the new forest admin agent is designed to work with multiple databases, the return value of the filter function is not a Sequelize or mongoose condition anymore.

Instead, you'll be building a [condition tree](../../../under-the-hood/queries/filters.md#condition-trees) that will be translated to the appropriate database syntax by the agent.

### Emulation

At the cost of performance, you can tell the agent to [emulate](../../../agent-customization/fields/filter.md#emulation) the behavior of a given operator by calling the `.emulateFieldOperator()` function.

### Example

{% tabs %} {% tab title="Before" %}

```javascript
collection('users', {
  fields: [
    {
      field: 'full_address',
      type: 'String',
      get: /* ... same as before ... */,
      filter: ({ condition, where }) => {
        switch (condition.operator) {
          case 'equal':
            return { $and: [/* ... sequelize or mongoose conditions ... */] };
          case 'less_than':
            return { $and: [/* ... sequelize or mongoose conditions ... */] };

          // [...] all other operators
        }
      },
    },
  ],
});
```

{% endtab %} {% tab title="After" %}

```javascript
agent.customizeCollection('users', users => {
  users
    .addField('full_address', { /* ... same as before ... */ })

    // Implement the operators you actually use for best performance.
    .replaceFieldOperator('full_address', 'Equal', (value, context) => ({
      aggregator: 'And', conditions: [{ /* ... forest admin query interface conditions ... */ }]
    })
    .replaceFieldOperator('full_address', 'LessThan', (value, context) => ({
      aggregator: 'And', conditions: [{ /* ... forest admin query interface conditions ... */ }]
    })

    // Emulate the other operators with the ones you implemented.
    .emulateFieldOperator('full_address', 'GreaterThan')
    .emulateFieldOperator('full_address', 'NotEqual')

    // [Or] Emulate all operators which are not already defined at once
    .emulateFieldFiltering('full_address');
});
```

{% endtab %} {% endtabs %}
