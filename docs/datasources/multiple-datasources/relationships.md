The add relation mechanism allows you to add a relation between different data sources, regardless of their type.
It is a very powerful feature to link your different data sources.

```javascript
const { createAgent } = require('@forestadmin/agent');
const { createSqlDataSource } = require('@forestadmin/datasource-sql');
const { createMongooseDataSource } = require('@forestadmin/datasource-mongoose');
// It gets the mongoose connection with its model declarations.
// please go to mongoose section to know more about this line.
const connection = require('./mongoose-models'); 

// Instanciate data sources.
const sqlDataSource = createSqlDataSource('postgres://user:pass@localhost:5432/mySchema');
const mongooseDataSource = createMongooseDataSource(connection);

// Plug every created data sources to the agent.
const agent = createAgent(options).addDataSource(sqlDataSource).addDataSource(mongooseDataSource);

// Add a relation between a Mongoose collection and a SQL collection.
agent.customizeCollection('myMongooseCollection', collection =>
  collection.addOneToManyRelation('myTowns', 'mySQLCollection', {
    originKey: 'country_id',
  })
);
```

{% hint style="info" %}
If you want to know more about adding relation, please refer to this [section](../custom/query-translation/relationships.md).
{% endhint %}
