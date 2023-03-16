In legacy agents declaring a smart field was done in one big step.

In the new agent, the process was split into multiple steps, depending on the capabilities of the field (writing, filtering, sorting, etc.).

This was done to reduce the complexity of the code and to make it easier to understand, but also because it allows customers to reuse the same API when customizing the behavior of normal fields, and thus reduce the API surface that you need to learn.

# Code cheatsheet

| Legacy agent                              | New agent                                                  |
| ----------------------------------------- | ---------------------------------------------------------- |
| get: (record) => { ... }                  | getValues: (records) => { ... }                            |
| set: (record, value) => { ... }           | replaceFieldWriting(...)                                   |
| filter: ({ condition, where }) => { ... } | .replaceFieldFiltering(...)<br>.emulateFieldFiltering(...) |
| enums: ['foo', 'bar']                     | columnType: 'Enum', enumValues: ['foo', 'bar']             |
| type: 'String'                            | columnType: 'String'                                       |

# Do you need a computed field?

Smart fields were a powerful tool, but they were also a performance bottleneck.

In the new agent, we have introduced two new concepts that can replace many of the use cases of smart fields:

If you were using a smart field to move a field from one collection to another or to create a link to another record in the UI, you can likely use one of these much simpler solutions.

- [Moving, renaming, or deleting fields](../../../agent-customization/fields/import-rename-delete.md)
- [Relationships](../../../agent-customization/relationships/README.md)

# Steps

## Step 1: Implement a read-only version of the field

Computed fields in the new agent are declared by calling the `addField` function on the appropriate collection.

In the following example, we will port a field that fetches the full address of a user from a third-party service.

Many things have changed with the new agent!
The motive is mainly performance: exposing a batch API to our customers is a much better solution than calling the API once per record.

When displaying a list of records, the new agent will only make one call to the API, and then display the results for all records, instead of making one call per record.

Here are the main differences in the code:

- The `field` property no longer exists. The field name is now the first argument of the `addField` function.
- The `dependencies` property is now required.
  - It is an array of field names that the `getValues()` function depends on.
  - Unlike the legacy agent, the new agent will not automatically fetch the whole record.
  - You can [fetch data from relations](../../../agent-customization/fields/computed.md#adding-a-field-that-depends-on-a-many-to-one-relationship) using the `dependencies` property!
  - You can also fetch data from other computed fields using the `dependencies` property.
- The `reference` property no longer exists. You can port `Smart Relationships` by following the [appropriate guide](./smart-relationships.md).
- The `enums` property was renamed to `enumValues`.
- The `get` function is now called `getValues`
  - It no longer takes a single record as its first argument, but an array of records.
  - It now returns an array of values, one for each record, in the same order.

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

## Step 2: Make it writable

If the field is writable, you will need to call another customization function: `collection.replaceFieldWriting()`.

## Step 3: Make it filterable
