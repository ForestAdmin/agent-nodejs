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
    taskCollection.addField('title', {
      columnType: 'String',
      dependencies: ['authorName', 'id'],
      getValues: tasks => tasks.map(task => `${task.authorName}-${task.id}`),
    });
  })
  // customize the user collection from the added datasource
  .customizeCollection('user', userCollection => {
    userCollection.addField('name', {
      columnType: 'String',
      dependencies: ['firstName', 'lastName'],
      getValues: users => users.map(user => `${user.firstName} ${user.lastName}`),
    });
  });
```

# Best practices

Extract your customizations in a separate file to keep your agent file clean.

For example, you could create a `customizeTaskCollection.js` file that contains all your customizations:

```javascript
// customizeTaskCollection.js file

module.exports = taskCollection => {
  taskCollection.addField('title', {
    columnType: 'String',
    dependencies: ['authorName', 'id'],
    getValues: tasks => tasks.map(task => `${task.authorName}-${task.id}`),
  });
};
```

Then, import this file in your agent file:

```javascript
// index.js file

const { createAgent } = require('@forestadmin/agent');
const customizeTaskCollection = require('./customizeTaskCollection');

createAgent()
  .addDataSource(createSqlDataSource('mariadb://user:password@localhost:3808/example'))
  .customizeCollection('task', customizeTaskCollection);
```

The `customizeCollection` method is chainable, so you can customize multiple collections in a single agent file.

This is useful if you have a lot of customizations to make on your datasource.
