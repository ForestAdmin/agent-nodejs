Out of the box, Forest Admin will not create links between collections from different data sources.

This is solved by defining `jointures`.

When a jointure is defined between two collections Forest Admin will act as if the two collections were linked with a native relationships (i.e. like two collections within the same SQL database).

Which means that:

- The relation can be traversed in the user interface
- Actions, charts, fields and segments can be created using fields from both sides of the relations.

## Example

```javascript
const SqlDataSource = require('@forestadmin/datasource-sql');
const DummyDataSource = require('@forestadmin/datasource-dummy');
const Agent = require('@forestadmin/agent');

const agent = new Agent(options);
const database = new SqlDataSource('postgres://user:pass@localhost:5432/mySchema');
const dummy = new DummyDataSource();

// Plug data sources
agent.addDataSource(database);
agent.addDataSource(dummy);

// Link 'customer' from database ...
agent.customizeCollection('customers', collection =>
  // ... to 'city' from dummy data source
  collection.registerJointure('myDummyCity', {
    type: FieldTypes.OneToOne,
    foreignCollection: 'cities', // this collection is in the dummy data source
    originKey: 'external_city_id', // field on dummy
  }),
);
```

## Jointure types

All [jointures types](../under-the-hood/data-model/relationships.md) are supported

When defining jointures, if no `foreignKeyTarget` or `originKeyTarget` is provided, the primary keys of respectively the origin and foreign models will be used.

## Preconditions

Cross-datasource relationships can only work when the underlying datasource ensures that values in columns used as `originKeyTarget` and `foreignKeyTarget` are unique.

## Advanced use-cases

On some situations you may need to create a relation between two collections which do not share a common key.

This can be achieved by [creating a new field](../agent-customization/fields.md) that will serve as a foreign key.

```javascript
const agent = new Agent(options);

agent.customizeCollection('customers', collection => {
  // Create foreign key
  collection.registerField('myForeignKey', {
    // Ensure this field is accesible for the jointure
    beforeJointures: true,

    // Compute foreign key value from other fields
    dependencies: [...],
    getValues: records => record.map(r => ...),

    // Implement the In operator, so that the foreign key can be used as a jointure
    filterBy: {
      [Operator.In]: value => ({ field: 'xxx', operator: 'xxx', value: 'xxx' }),
    },
  });

  // Use the foreign key we just created in a jointure
  collection.registerJointure('myRelation', {
    type: FieldTypes.ManyToOne,
    foreignCollection: 'someOtherCollection',
    foreignKey: 'myForeignKey', // field on Postgres
  });
});
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
SELECT authors.id, authors.firstName, authors.lastName FROM authors WHERE id IN (83948934);
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
