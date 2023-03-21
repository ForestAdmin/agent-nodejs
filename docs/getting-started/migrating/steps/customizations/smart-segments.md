Smart Segments should be quick to migrate, as the syntax is very similar to the legacy agent.

# Code cheatsheet

| Legacy agent    | New agent                                                                       |
| --------------- | ------------------------------------------------------------------------------- |
| where:          | handler body                                                                    |
| sequelize.where | [condition tree](../../../../under-the-hood/queries/filters.md#condition-trees) |

# How to migrate ([docs](../../../../agent-customization/segments.md))

## Structure

Because the new forest admin agent is designed to work with multiple databases, the return value of the filter function is not a Sequelize or mongoose condition anymore.

Instead, you'll be building a [condition tree](../../../../under-the-hood/queries/filters.md#condition-trees) that will be translated to the appropriate database syntax by the agent.

## Performance

All queries cannot be expressed in the forest admin query interface, but many can.

You can have great performance improvements by using the forest admin query interface to build your conditions, instead of performing the query yourself, and then building a naive condition tree, which filters by primary key like in the example we're providing.

## Example

In this example, we migrate a segment that returns the 5 bestsellers of a product collection.

{% tabs %} {% tab title="Before" %}

```javascript
collection('products', {
  segments: [{
    name: 'Bestsellers',
    where: product => {
      const query = `
        SELECT products.id, COUNT(orders.*)
        FROM products
        JOIN orders ON orders.product_id = products.id
        GROUP BY products.id
        ORDER BY count DESC
        LIMIT 5;
      `;

      const products = await models.connections.default.query(query, { type: QueryTypes.SELECT })

      return { id: { [Op.in]: products.map(product => product.id) } };
    },
  }],
});
```

{% endtab %} {% tab title="After" %}

```javascript
agent.customizeCollection('products', products => {
  products.addSegment('Bestsellers', async () => {
    const query = `
      SELECT products.id, COUNT(orders.*)
      FROM products
      JOIN orders ON orders.product_id = products.id
      GROUP BY products.id
      ORDER BY count DESC
      LIMIT 5;
    `;

    const products = await models.connections.default.query(query, { type: QueryTypes.SELECT });

    return { field: 'id', operator: 'In', value: products.map(product => product.id) };
  });
});
```

{% endtab %} {% endtabs %}
