The mongoose data source allows to import collections from a mongoose instance.

Note that:
- Mongoose `ref` with type `ObjectID` will be transformed to a `many to one` relation.
- Mongoose `ref` with type `[ObjectID]` will be transformed to a `many to many` relation


```javascript
const { createAgent } = require('@forestadmin/agent');
const { createMongooseDataSource } = require('@forestadmin/datasource-mongoose');
const mongoose = require('mongoose');

const options = AgentOptions = {
    authSecret: 'my-auth-secret-from-onboarding',
    envSecret: 'my-env-secret-from-onboarding',
    agentUrl: 'my-agent-url',
    isProduction: false,
};

// Create a mongoose connection
const connection = mongoose.createConnection('mongodb://user:password@localhost:27017');

connection.model('user',
    new mongoose.Schema({
        username: { type: String },
        birthday: { type: Date },
    }),
);

// Create agent and import collections from mongoose
const agent = createAgent(options).addDataSource(createMongooseDataSource(mongoose));
```
