Adding as many datasources as you need is good, inter-connecting them together is better.

The relation mechanism allows you to add a relation between different data sources, regardless of their type in the same way than you define relation within a given datasource.

{% hint style="info" %}
If you want to know more about adding relations, please refer to this [section](../custom/relationships.md).
{% endhint %}

```javascript
const { createAgent } = require('@forestadmin/agent');
const { createSqlDataSource } = require('@forestadmin/datasource-sql');
const { createMongooseDataSource } = require('@forestadmin/datasource-mongoose');

// Plug multiple datasources to a single agent.
const agent = createAgent(options)
  .addDataSource(createSqlDataSource('postgres://user:pass@a.server:5432/mySchema'))
  .addDataSource(createSqlDataSource('postgres://user:pass@another.server:5432/anotherSchema'))
  .addDataSource(createMongooseDataSource(require('./mongoose-models')));

// Add a relation between a Mongoose collection and a SQL collection.
agent.customizeCollection('countryFromMongoose', collection =>
  collection.addOneToManyRelation('towns', 'townsFromPostgres', {
    originKey: 'country_id',
  }),
);
```
