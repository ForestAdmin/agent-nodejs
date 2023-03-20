To connect the new agent to a MongoDB instance, you still need to use the `mongoose` ODM.

You will need to:

- Install the `@forestadmin/datasource-mongoose` package.
- Copy your `mongoose` models to the new project.
- Create a new `mongoose` connection to the same database as the old one.

```javascript
const { createAgent } = require('@forestadmin/agent');
const { createMongooseDataSource } = require('@forestadmin/datasource-mongoose');
const connection = require('./mongoose-models');

// Create agent and import collections from mongoose.connection
const agent = createAgent(options).addDataSource(createMongooseDataSource(connection));
```

# Replicate your legacy agent flattener configuration

If you are using the `forest-express-mongoose` agent, you probably are using the [flattener](https://docs.forestadmin.com/documentation/how-tos/setup/flatten-nested-fields-mongodb) feature.

In the new agent, the flattener is [more capable](../../../datasources/provided/mongoose.md), but the behavior of the new `auto` mode is different.

To replicate the behavior of the old agent, you will need to use the `manual` mode and configure the flattener manually.

{% hint style="info" %}
You may have noticed that a `flattenMode: 'legacy'` option is available.
This option **does not** replicate the behavior of legacy agents, but the behavior of a previous version of the model flattener in the new agents.

If you are migrating from a legacy agent, use the `manual` mode.
{% endhint %}

{% tabs %} {% tab title="Before" %}

```javascript
import { collection } from 'forest-express-mongoose';

collection('users', {
  /** ... other options ... */
  fieldsToFlatten: ['contactDetails'],
});

collection('products', {
  /** ... other options ... */
  fieldsToFlatten: [{ field: 'characteristics', level: 1 }],
});
```

{% endtab %} {% tab title="After" %}

If you were using `fieldsToFlatten` in your old agent.

```javascript
const agent = createAgent(options).addDataSource(
  createMongooseDataSource(connection, {
    flattenMode: 'manual',
    flattenOptions: {
      users: { asFields: ['contactDetails'] },
      products: { asFields: [{ field: 'characteristics', level: 1 }] },
    },
  }),
);
```

Otherwise

```javascript
const agent = createAgent(options).addDataSource(
  createMongooseDataSource(connection, { flattenMode: 'none' }),
);
```

{% endtab %} {% endtabs %}
