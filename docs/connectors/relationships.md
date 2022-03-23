When importing collections from a data source which supports relationships, all collections should be linked together from the get go.

Out of the box, Forest Admin will not create relations between different data sources.

This is a strong limitation which is solved by defining `jointures`.

When a jointure is defined between two collections, from both the user and agent developer point of view, Forest Admin will act as if the two collections were linked with a native relationships (i.e. like two collections within the same SQL database).

Which means that:

- The relation can be traversed in the user interface
- Actions, charts, fields and segments which use information from both collections can be built with no changes in the API that is used.

# Usage

## Example

```javascript
const SqlConnector = require('@forestadmin/connector-sql');
const IntercomConnector = require('@forestadmin/connector-intercom');
const Agent = require('@forestadmin/agent');

const agent = new Agent(options);

agent
  // Import collections
  .importCollectionsFrom(new SqlConnector('postgres://user:pass@localhost:5432/mySchema'))
  .importCollectionsFrom(new IntercomConnector({ accessToken: 'TmljZSB0cnkgOik=' }), {
    rename: { contacts: 'intercomContacts' },
  })

  // Link customer records ...
  .customizeCollection('customers', collection =>
    // ... to intercom contacts
    collection.registerJointure('myIntercomContact', {
      type: FieldType.OneToOne,
      foreignCollection: 'intercomContacts',
      originKey: 'external_id', // field on Intercom
    }),
  );
```

## Jointure types

A jointure is used to combine rows from two or more tables, based on a related column between them.

Four jointure types are available: `ManyToOne`, `ManyToMany`, `OneToMany` and `OneToOne`.

| Type         | Where are the common keys?                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------ |
| Many to One  | origin[foreignKey] == foreign[foreignKeyTarget]                                                  |
| One to Many  | origin[originKeyTarget] == foreign[originKey]                                                    |
| Many to Many | origin[originKeyTarget] == through[originKey] && though[foreignKey] == foreign[foreignKeyTarget] |
| One to One   | origin[originKeyTarget] == foreign[originKey]                                                    |

When defining jointures, if no `foreignKeyTarget` or `originKeyTarget` is provided, the primary keys of respectively the origin and foreign models will be used.

## Preconditions

Cross-datasource relationships can only work when:

- All fields which are used as either `originKey`, `originKeyTarget`, `foreignKey` and `foreignKeyTarget` are filterable with the `In` operator.
- The underlying datasource ensures that values in columns used as `originKeyTarget` and `foreignKeyTarget` are unique across the collection.

## Advanced use-cases

On some situations you may need to create a relation between two collections which do not share a common key.

This can be achieved by [creating a new field](../agent-customization/fields.md) that will serve as a foreign key.

```javascript
const agent = new Agent(options);

agent.customizeCollection('customers', collection =>
  collection
    // Create foreign key
    .registerField('myForeignKey', {
      // Compute foreign key value from other fields
      dependencies: [...],
      getValues: (records) => record.map(r => ...),

      // Ensure this field is accesible for the jointure
      beforeJointures: true,

      // Implement the In operator, so that the foreign key can be used as a jointure
      filterBy: {
        [Operator.In]: (value) => ({field: 'xxx', operator: 'xxx', value: 'xxx'})
      }
    })

    // Use the foreign key we just created in a jointure
    .registerJointure('myRelation', {
      type: FieldType.ManyToOne,
      foreignCollection: 'someOtherCollection',
      foreignKey: 'myForeignKey', // field on Postgres
    }),
);
```

# Under the hood

Cross-datasource jointures work by transparently analysing the requests which are performed by the frontend and customer API in your agent, and translating them into multiple requests to the relevant data sources.

For instance, supposing that:

- You defined a jointure between two collections `books` and `authors`
- Both collections are hosted on different SQL databases
- You display the book list on your admin panel

```sql
-- The frontend needs the result of that query to display the 'list view'
-- which cannot be performed, because books and authors are on different databases
SELECT books.title, authors.firstName, authors.lastName
FROM books
INNER JOIN authors ON authors.id = books.id
WHERE books.title LIKE 'Found%'
```

The request will be transparently split and its result merged to produce the same output that if the origin query was run.

```sql
-- Step 1: Query database containing books (including foreign key)
SELECT books.title, books.authorId FROM books WHERE books.title LIKE 'Found%';

> | title      | authorId |
> | Foundation | 83948934 |

-- Step 2: Query database containing authors (including pk)
> SELECT authors.id, authors.firstName, authors.lastName FROM authors WHERE id IN (83948934);
> | id       | firstName | lastName |
> | 83948934 | Isaac     | Asimov   |

-- Step 3: Merge results (using books.authorId === authors.id)
> | title      | authorId | firstName | lastName |
> | Foundation | 83948934 | Isaac     | Asimov   |
```

{% hint style="warning" %}
Automatic query splitting is a very powerful tool however not all queries are created equal.

In this simple example, it is a straighforward three step process, but the feature can come at the cost of performance on more complex queries.
{% endhint %}
