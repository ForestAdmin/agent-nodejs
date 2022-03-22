When importing collections from a data source which supports relationships, all collections should be linked together from the get go.

However, Forest Admin cannot guess how the collections in your own database are related to those imported using other connectors.

This is a strong limitation which is solved by defining `jointures`.

When a jointure is defined between two collections, from both the user and agent developer point of view, Forest Admin will act as if the two collections were linked with a native relationships (i.e. like two collections within the same SQL database).

Which means that:

- The relation can be traversed in the user interface
- Actions, charts, fields and segments which use information from both collections can be built with no changes in the API that is used.

# Usage

## Example

```javascript
const agent = new Agent(options);

agent
  // Import collections
  .importCollections(new SqlConnector('postgres://user:pass@localhost:5432/mySchema'))
  .importCollections(new StripeConnector({ apiKey: 'sk_test_VePHdqKTYQjKNInc7u56JBrQ' }), {
    rename: { customers: 'stripeCustomers' },
  })
  .importCollections(new IntercomConnector({ accessToken: 'TmljZSB0cnkgOik=' }), {
    rename: { contacts: 'intercomContacts' },
  })

  // Link customer records ...
  .customizeCollection('customers', collection =>
    collection
      // ... to intercom contacts
      .registerJointure('myIntercomContact', {
        type: FieldType.OneToOne,
        foreignCollection: 'intercomContacts',
        originKey: 'external_id', // field on Intercom
      })

      // ... to stripe customers
      .registerJointure('myStripeCustomer', {
        type: FieldType.OneToMany,
        foreignCollection: 'stripeCustomers',
        foreignKey: 'stripeId', // field on Postgres
      }),
  );
```

## Jointure types

Four jointure types are available: `ManyToOne`, `ManyToMany`, `OneToMany` and `OneToOne`.

| Type         | Where are the common keys?                                                                       |
| ------------ | ------------------------------------------------------------------------------------------------ |
| Many to One  | origin[foreignKey] == foreign[foreignKeyTarget]                                                  |
| One to Many  | origin[originKeyTarget] == foreign[originKey]                                                    |
| Many to Many | origin[originKeyTarget] == through[originKey] && though[foreignKey] == foreign[foreignKeyTarget] |
| One to One   | origin[originKeyTarget] == foreign[originKey]                                                    |

When defining jointures, if no `foreignKeyTarget` or `originKeyTarget` is provided, the primary keys of respectively the origin and foreign models will be used.

## Preconditions & Limitations

Cross-datasource relationships can only work when

- All fields which are used as either `originKey`, `originKeyTarget`, `foreignKey` and `foreignKeyTarget` are filterable with the `In` operator.
- The underlying datasource ensures that values in columns used as `originKeyTarget` and `foreignKeyTarget` are unique across the collection.

{% hint style="warning" %}
Automatic query splitting so that they can transparently run across incompatible data sources is a very powerful tool however not all queries are created equal and using the feature extensively can come at the cost of performance for some operations (most notably cross-datasource charts).
{% endhint %}

# Under the hood

Cross-datasource jointures work by transparently analysing the requests which are performed by the frontend and customer API in your agent, and translating them into multiple requests to the relevant data sources.

For instance, supposing that

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

In that simple case, the request will be transparently split and its result merged in a three step process.

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
