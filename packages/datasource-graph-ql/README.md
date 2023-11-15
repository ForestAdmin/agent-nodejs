The GraphQL datasource allows importing collections from a GraphQL server.

To make everything work as expected, you need to install the package `@forestadmin-experimental/datasource-graph-ql`.

## Options
* serverApiUrl: String defined the GraphQL server url
* scalarMapping: (optional) Map defined the [primitive type](https://forestadmin.github.io/agent-nodejs/types/_forestadmin_datasource_toolkit.PrimitiveTypes.html) to use to transfom user define scalar type
* scalarIdentifier: (optional) String defined the scalar type used as identifer (default to ID)

## Introspection under the hood
The introspection system run an introspection query from GraphQL.

Based on GraphQL best practice and more precisly on [cursor connection pagination](https://graphql.org/learn/pagination/#complete-connection-model), the introspection take into account all schema as collection folling the description below.
```graphql
# Define basic entity
interface Resource {
  id: ID!
}

# Define basic edge
interface Edge {
  cursor: String
  node: Resource
}

# Define basic connection
interface Connection {
  edges: [Edge]
}
```

You must have an interface named `Connection` and `Edge` to make it work.
All queries that return a schema implement `Connection` as below was translating into collection.

```graphql
# Define Author entity
type Author implements Resource {
  id: ID!
  name: String!
}

# Define edge Author
type AuthorEdge implements Edge {
  cursor: String
  node: Author!
}

# Define Author connection
type AuthorConnection implements Connection {
  edges: [AuthorEdge!]!
}

extend type Query {
  # Get list of Author
  authors(first: Int, last: Int, after: ID, before: ID): AuthorConnection!
}
```

If you want to be able to see details of a record and/or be able to make `belongsTo` relation, you must declare a query following the need below.
```graphql
extend type Query {
  # Get one Author
  # the params must be the same as the identifier difined on the Author schema
  # the query must return the same schema as the node edge connetion on the list (eg: Author)
  author(id: ID!): Author!
}
```

And now you will be able to create a `belongsTo` like below.
```graphql
# Define Book entity
type Book implements Resource {
  id: ID!
  title: String!
  # Here this is hanle as a belongsTo
  author: Author
}

# Define edge Book
type BookEdge implements Edge {
  cursor: String
  node: Book!
}

# Define Book connection
type BookConnection implements Connection {
  edges: [BookEdge!]!
}

extend type Query {
  # Get list of Book
  books(first: Int, last: Int, after: ID, before: ID): BookConnection!
}
```

### Limitations
Due to GraphQL limitation and the fact we does not handled filter
* Schema not "listable" as explain above was handled as `JSON`
* `hasMany` was hanlded has embeded
* No `hasOne` support
* No CUD operations => smart actions
* No aggregation => no chart and so on

## example
```javascript
import { createAgent } from '@forestadmin/agent';

import { createGraphQLDataSource } from '@forestadmin-experimental/datasource-graph-ql';

const agent = createAgent(options)
.addDataSource(
  createGraphQLDataSource({
    serverApiUrl: 'http://localhost:4000/graphql',
    scalarMapping: {
      ISODateString: 'Date',
      ExternalID: 'String',
    },
    scalarIdentifier: 'ExternalID',
  }),
);
```
