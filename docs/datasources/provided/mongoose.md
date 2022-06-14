The mongoose data source allows to import collections from a mongoose instance.

## Example

{% tabs %} {% tab title="agent.js" %}

```javascript
const { createAgent } = require('@forestadmin/agent');
const { createMongooseDataSource } = require('@forestadmin/datasource-mongoose');
const connection = require('./mongoose-models');

// Create agent and import collections from mongoose.connection
const agent = createAgent(options).addDataSource(createMongooseDataSource(mongoose.connection));
```

{% endtab %} {% tab title="mongoose-models.js" %}

```javascript
import mongoose from 'mongoose';

const connectionString = 'mongodb://root:password@localhost:27027';
const connection = mongoose.createConnection(connectionString);

connection.model(
  'accounts',
  new mongoose.Schema({
    firstname: String,
    lastname: String,

    // Nested object
    address: { streetName: String, city: String, country: String },

    // List of nested objects
    bills: [{ title: String, amount: Number, issueDate: Date }],
  }),
);

export default connection;
```

{% endtab %} {% endtabs %}

## Dealing with deeply nested models

By default:

- Each mongoose model will be mapped to a single forest admin collection.
- Fields and arrays of fields at the root of models which use the mongoose `ref` keyword will be converted into a two-way relations.

As models in mongoose can be deeply nested, that may not be what you want: the mongoose connector allows to map a single mongoose model to multiple forest admin collections.

Supposing that accounts have the following format:

```json
{
  "name": "Sherlock Holmes",
  "age": 54,
  "address": {
    "streetName": "Baker Street",
    "city": "London",
    "country": "Great Britain"
  },
  "bills": [
    {
      "title": "Rent",
      "amount": 0,
      "issueDate": "1887-04-17",
      "payedBy": ["Sherlock", "John", "Mrs Hudson"]
    }
  ]
}
```

You can split the mongoose model in four forest admin collections using the following code.

```javascript
const dataSource = createMongooseDataSource(mongoose.connection, {
  asModels: {
    accounts: ['address', 'bills', 'bills.payedBy'],
  },
});
```
