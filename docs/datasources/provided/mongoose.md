The mongoose data source allows importing collections from a mongoose instance.

To make everything work as expected, you need to install the package `@forestadmin/datasource-mongoose`.

{% tabs %} {% tab title="agent.js" %}

```javascript
const { createAgent } = require('@forestadmin/agent');
const { createMongooseDataSource } = require('@forestadmin/datasource-mongoose');
const connection = require('./mongoose-models');

// Create agent and import collections from mongoose.connection
const agent = createAgent(options).addDataSource(
  createMongooseDataSource(connection, { flattenMode: 'none' }),
);
```

{% endtab %} {% tab title="mongoose-models.js" %}

```javascript
const mongoose = require('mongoose');

const connectionString = 'mongodb://root:password@localhost:27017';
const connection = mongoose.createConnection(connectionString);

connection.model(
  'persons',
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

![One Mongoose collection split into four Forest-Admin collections](../../assets/datasource-mongo.png)

When passing `flattenMode: 'none'` to the mongoose data source, the connector will map each mongoose model to a single forest admin collection without transformations.

As models in mongoose can be deeply nested, that may not be what you want:

- Nested references will not be displayed as relations.
- JSON editors will be displayed for nested data.

### Understanding `flattenMode`

|                         | Description                                                                                                                                                 |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `flattenMode: 'auto'`   | Arrays of objects and arrays of references are converted to independent forest admin collections. All other fields are moved to the root of each collection |
| `flattenMode: 'manual'` | You are in full control on which virtual collections are created, and which fields are moved                                                                |
| `flattenMode: 'none'`   | No transformation are made: forest admin collection use the exact same structure than your mongoose models                                                  |
| `flattenMode: 'legacy'` | Retro-compatibility with previous versions                                                                                                                  |
| not defined             | Equivalent to `legacy` but a warning is displayed at server startup                                                                                         |

### Example

Supposing that `persons` records have the following format:

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

The following samples are equivalent, and will import two collections into your forest admin panel:

- `persons` with the following fields: `name`, `age`, `address->streetName`, `address->city`, `address->country`.
- `persons_bills` with the following fields: `title`, `amount`, `issueDate`, `payedBy`.

```javascript
// Automatic mode
const dataSource = createMongooseDataSource(mongoose.connection, { flattenMode: 'auto' });

// Manual mode
const dataSource = createMongooseDataSource(mongoose.connection, {
  flattenMode: 'manual',
  flattenOptions: {
    // name of the mongoose model
    persons: {
      // paths that should be converted to independent collections
      asModels: ['bills'],

      // paths that should be moved to the root of the collection
      asFields: ['address'],
      // or
      // asFields: ['address.streetName', 'address.city', 'address.country'],
      // or
      // asFields: [{ field: 'address', level: 1 }],
    },
  },
});
```
