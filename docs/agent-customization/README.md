Customization refers to a series of actions that enable you to personalize your agent, data source, or collection.

An agent is an HTTP server that serves the Forest Admin front-end application.
A data source is a database or an API that you want to connect to Forest Admin.
A collection is a set of data that you want to manage in Forest Admin.

Among other things, you can modify your agent by incorporating data sources, using plugins, customizing collections, and adding charts.
Additionally, you can personalize your data sources by offering choices that cater to all data source types.
Lastly, you can adapt your collections by including actions, fields, relations, segments between the data sources and other functionalities.

# Customizing your collection

To learn more about the customization options available to you, see the following menu.

To customize a collection, your best bet is to use the `customizeCollection` method.

The `customizeCollection` method allows you to customize a collection's behavior.

This method takes two parameters:

- The `name` of the collection you want to customize.
- The `function` that defines the customizations you want to make.

# Usage

For the example below we
will [create an agent](https://docs.forestadmin.com/developer-guide-agents-nodejs/getting-started/install/create-your-agent)
and customize the `task` and `user` collections from
a [datasource](https://docs.forestadmin.com/developer-guide-agents-nodejs/data-sources/connection).

```javascript
const { createAgent } = require('@forestadmin/agent');

createAgent()
  // add your data source
  .addDataSource(createSqlDataSource('mariadb://user:password@localhost:3808/example'))
  // customize the task collection from the added datasource
  .customizeCollection('task', taskCollection => {
    taskCollection.addField('title', {
      /* ... field definition ... */
    });
  })
  // customize the user collection from the added datasource
  .customizeCollection('user', userCollection => {
    userCollection.addField('name', {
      /* ... field definition ... */
    });
  });
```

# Auto-completion & Typings & Best practices

You may refer to this [this section](https://docs.forestadmin.com/developer-guide-agents-nodejs/getting-started/install/autocompletion-and-typings) in order to activate auto-completion and typings.
