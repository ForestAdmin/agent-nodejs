To customize a collection, your best bet is to use the `customizeCollection` method.

The `customizeCollection` method allows you to customize a collection's behavior.

This method takes two parameters:

- The `name` of the collection you want to customize.
- The `function` that defines the customizations you want to make.

# Usage

For the example below we
will [create an agent](https://docs.forestadmin.com/developer-guide-agents-nodejs/getting-started/install/create-your-agent)
that will customize the `task` and `user` collections from
a [datasource](https://docs.forestadmin.com/developer-guide-agents-nodejs/data-sources/connection).

```javascript
const { createAgent } = require('@forestadmin/agent');

createAgent()
  // add your data source
  .addDataSource(createSqlDataSource('mariadb://user:password@localhost:3808/example'))
  // customize the task collection from the added datasource
  .customizeCollection('task', taskCollection => {
    taskCollection.addField('title', {});
  })
  // customize the user collection from the added datasource
  .customizeCollection('user', userCollection => {
    userCollection.addField('name', {});
  });
```

# Auto-completion & Typings & Best practices

You may refer to this [this section](https://docs.forestadmin.com/developer-guide-agents-nodejs/getting-started/install/autocompletion-and-typings) in order to activate auto-completion and typings.
