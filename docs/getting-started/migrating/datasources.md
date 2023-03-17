If you are migrating a datasource

# For `forest-express-sequelize` agents

To connect your new agent to a SQL database, you have two options:

- Use the `sequelize` ORM, like the old agent.
- Connect directly to the database using the `@forestadmin/datasource-sql` package.

The choice depends on your use case: customers that have in-app installations and use the `sequelize` ORM will probably want to keep using it.

# For `forest-express-mongoose` agents

## Connect to your MongoDB instance

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
const agent = createAgent(options).addDataSource(
  createMongooseDataSource(connection, { flattenMode: 'auto' }),
);
```

## Replicate your legacy agent flattener configuration

If you are using the `forest-express-mongoose` agent, you probably are using the [flattener](https://docs.forestadmin.com/documentation/how-tos/setup/flatten-nested-fields-mongodb) feature.

In the new agent, the flattener is more capable, but the behavior of the `auto` mode is different.

To replicate the behavior of the old agent, you will need to use the `manual` mode and configure the flattener manually.

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

{% endtab %} {% endtabs %}

# For other agents (rails, django, ...)
