The relation mechanism allows you to add a relation between different data sources, regardless of their type.
It is a very powerful feature to link your different data sources.

```javascript
const { createAgent } = require('@forestadmin/agent');
const { createSqlDataSource } = require('@forestadmin/datasource-sql');
const { createMongooseDataSource } = require('@forestadmin/datasource-mongoose');

// Mongoose connection with its model declarations.
const connection = require('./mongoose-models');

// Instanciate data sources.
const sqlDataSource = createSqlDataSource('postgres://user:pass@localhost:5432/mySchema');
const mongooseDataSource = createMongooseDataSource(connection);

// Plug every created data sources to the agent.
const agent = createAgent(options).addDataSource(sqlDataSource).addDataSource(mongooseDataSource);

// Add a relation between a Mongoose collection and a SQL collection.
agent.customizeCollection('countryFromMongoose', collection =>
  collection.addOneToManyRelation('towns', 'townsFromSQL', {
    originKey: 'country_id',
  }),
);
```

{% hint style="info" %}
If you want to know more about adding relation, please refer to this [section](../custom/relationships.md).
{% endhint %}
