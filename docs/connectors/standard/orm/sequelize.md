The sequelize connector allows to import collections from a sequelize instance.

Note that:

- Sequelize scopes will be mapped to Forest Admin segments
- Sequelize hooks will run
- Sequelize association, field aliasing, relationships and validation will be respected

```javascript
const Agent = require('@forestadmin/agent');
const SequelizeConnector = require('@forestadmin/connector-sql');
const { Sequelize, Model, DataTypes } = require('@sequelize/core');

// Create a sequelize instance
const sequelize = new Sequelize('sqlite::memory:');

class User extends Model {}
User.init(
  {
    username: DataTypes.STRING,
    birthday: DataTypes.DATE,
  },
  { sequelize, modelName: 'user' },
);

// Create agent and import collections from sequelize
const agent = new Agent(options);

agent.importCollectionsFrom(new SequelizeConnector(sequelize));
```
