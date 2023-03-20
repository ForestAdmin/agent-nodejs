Smart relationships are very different between the two versions of the Agent.

# Structure

Smart relationships on legacy agents were declared creating a smartfield with a `reference` property but differed in the way that:

- Relationships to a single record (many-to-one or one-to-one) worked using the `get` function which needed to return a single record.
- Relationships to a list of records (one-to-many or many-to-many) worked by implementing all the CRUD routes on a router file.

The new system is completely different: it is based on primary keys and foreign keys.

# Migrating

## Relationships when the foreign key is accessible ([docs](../../../agent-customization/relationships/single-record.md))

{% tabs %} {% tab title="Before" %}

```javascript
// Many to one relationships
collection('order', {
  fields: [
    {
      field: 'delivery_address',
      type: 'String',
      reference: 'Address._id',
      get: async order => {
        return models.addresses.find({ id: order.delivery_address_id });
      },
    },
  ],
});

// Reverse relationship
collection('address', {
  fields: [{ field: 'orders', type: ['String'], reference: 'Order.id' }],
});

router.get('/address/:id/relationships/orders', (req, res) => {
  // ... route handler
});

// ... other routes
```

{% endtab %} {% tab title="After" %}

```javascript
agent.customizeCollection('order', orders => {
  // Create the relationship
  orders.addManyToOneRelation('deliveryAddress', 'address', { foreignKey: 'deliveryAddressId' });

  // Create the reverse relationship
  orders.addOneToManyRelation('orders', 'order', { originKey: 'deliveryAddressId' });
});
```

{% endtab %} {% endtabs %}

## Relationships when you need complex logic to get a foreign key ([docs](../../../agent-customization/relationships/computed-fks.md))

In this example, we want to create a relationship between the `order` collection and the `address` collection
(assuming that it does not already exist in the database because depends on complex logic).

We can see that in the legacy agent, the `delivery_address` field was a smart field that returned the full address of the order, while in the new agent, we will create a computed field that will contain the address ID (the foreign key), and then create the relationship.

We won't be detailing the migration of a relation to a list of records here, but it is very similar to the one described below.

{% hint style="info" %}
If the foreign key was already present in the database in a related table, use the [import-rename-delete](../../../agent-customization/fields/import-rename-delete.md) feature to move it to the correct collection instead of using a computed field.

This will be much faster and will not require `In` filter operators to be implemented (as unlike computed fields, imported fields are natively filterable and sortable).
{% endhint %}

{% tabs %} {% tab title="Before" %}

```javascript
collection('order', {
  fields: [
    {
      field: 'delivery_address',
      type: 'String',
      reference: 'Address._id',
      get: async order => {
        return models.addresses.find(/* complex query */);
      },
    },
  ],
});
```

{% endtab %} {% tab title="After" %}

```javascript
agent.customizeCollection('order', orders => {
  // Create a computed field that will contain the address ID (the foreign key)
  orders.addField('deliveryAddressId', {
    columnType: 'Number',
    dependencies: ['id'],
    getValues: async orders => {
      const addressByOrderId = await models.addresses.find(/* complex query */);

      return orders.map(order => addressByOrderId[order.id].id);
    },
  });

  // Make the field filterable (this is required for the relationship to work, see documentation)
  orders.replaceFieldOperator('deliveryAddressId', 'In', (value, context) => {
    // implement the reverse-lookup logic here
  });

  // Create the relationship
  orders.addManyToOneRelation('deliveryAddress', 'address', { foreignKey: 'deliveryAddressId' });
});
```

{% endtab %} {% endtabs %}
