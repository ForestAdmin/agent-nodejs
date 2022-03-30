Mongoose support is coming soon!

<!--

The sequelize data source allows to import collections from a mongoose connection.

Note that:

- Sequelize scopes will be mapped to Forest Admin segments
- Sequelize hooks will run
- Sequelize association, field aliasing, relationships and validation will be respected

```javascript
const Agent = require('@forestadmin/agent');
const MongooseDataSource = require('@forestadmin/datasource-mongoose');
const mongoose = require('mongoose');

// Create a mongoose instance
mongoose.connect('mongodb://localhost:27017/test');

const User = mongoose.model('User', {
  username: String,
  birthDate: Date,
});

// Create agent and import collections from mongoose
const agent = new Agent(options);

agent.addDataSource(new MongooseDataSource(mongoose.connection));
```
-->
