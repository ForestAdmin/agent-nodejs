The mongoose data source allows importing collections from a mongoose instance.

To make everything work as expected, you need to install the package `@forestadmin/datasource-mongoose`.

{% tabs %} {% tab title="agent.js" %}

```javascript
const { createAgent } = require('@forestadmin/agent');
const { createMongooseDataSource } = require('@forestadmin/datasource-mongoose');
const connection = require('./mongoose-models');

// Create agent and import collections from mongoose.connection
const agent = createAgent(options).addDataSource(createMongooseDataSource(connection));
```

{% endtab %} {% tab title="mongoose-models.js" %}

```javascript
const mongoose = require('mongoose');

const connectionString = 'mongodb://root:password@localhost:27017';
const connection = mongoose.createConnection(connectionString);

connection.model(
  'account',
  new mongoose.Schema({
    name: String,
    age: Number,

    // Nested object
    address: { streetName: String, city: String, country: String },

    // List of nested objects
    bills: [{ title: String, amount: Number, issueDate: Date, payedBy: [String] }],
  }),
);

module.exports = connection;
```

{% endtab %} {% endtabs %}

## Dealing with deeply nested models

By default:

- Each mongoose model will be mapped to a single forest admin collection.
- Fields and arrays of fields at the root of models which use the mongoose `ref` keyword will be converted into a two-way relation.

As models in mongoose can be deeply nested, that may not be what you want: the mongoose connector allows mapping individual mongoose models to multiple forest admin collections.

### Example

Supposing that `account` records have the following format:

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

You can split the mongoose model into four forest admin collections using the following code.

```javascript
const dataSource = createMongooseDataSource(mongoose.connection, {
  asModels: {
    account: ['address', 'bills', 'bills.payedBy'],
  },
});
```

That will give the following result:

![One Mongoose collection split into four Forest-Admin collections](../../assets/datasource-mongo.png)
