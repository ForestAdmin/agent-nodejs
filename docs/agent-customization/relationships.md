Jointure allow to create arbitrary relationships between collections.

This serves two purposes:

- Links collections which came from different data sources
- Add links between collections from the same data source which were not provided out of the box

When jointures are defined between collections Forest Admin acts as if the two collections were linked with a native relationships:

- The relation can be traversed in the user interface
- Actions, charts, fields and segments can be created using fields from both sides of the relations.

# Example

## Inter-Datasource relationship

In this simple example, we have two collections which are not linked together:

- `Customers` whose primary key is `id` and comes from the main database.
- `Payments` which have a `customer_id` field and comes from a payment processor.

```javascript
// Link 'customers' to 'payments'
agent.customizeCollection('customers', collection =>
  collection.addRelation('myPayments', {
    type: 'OneToMany',
    foreignCollection: 'payments',
    originKey: 'external_id',
    originKeyTarget: 'id', // Optional (uses primary key by default)
  }),
);
```

The inverse relation can be declared in a similar way:

```javascript
// Link 'payments' to 'customers'
agent.customizeCollection('payments', collection =>
  collection.addRelation('myCustomer', {
    type: 'ManyToOne',
    foreignCollection: 'customers',
    foreignKey: 'external_id',
    foreignKeyTarget: 'id', // Optional (uses primary key by default)
  }),
);
```

{% hint style="info" %}
Note that relationships can target any unique key with `foreignKeyTarget` and `originKeyTarget`.
{% endhint %}

## Intra-Datasource relationship

When plugging a new data source, relationships will work out of the box, however you may want to add additional relations for user convenience.

Let's imagine that we have two collections: `Customers` and `Messages`.

Both collections are linked together by a `OneToMany` relationships, however, users of the admin panel only care about the last message sent by a user.

Therefor, we can create a `ManyToOne` relationship between `Customer` and `Messages`.

This is done in two steps:

- Create a new field containing a foreign key.
- Create a relation using it.

```javascript
agent.customizeCollection('customers', collection => {
  // Create foreign key
  collection.addField('lastMessageId', {
    // Ensure this field is accesible for the jointure
    beforeJointures: true,

    // Compute foreign key value from other fields
    dependencies: ['id'],
    getValues: async (customers, context) => {
      const messages = context.dataSource.getCollection('messages');
      const rows = await messages.aggregate(
        { field: 'customer_id', operator: 'in', value: customers.map(r => r.id) },
        { operator: 'Max', field: 'id', groups: [{ field: 'customer_id' }] },
      );

      return customers.map(record => {
        return rows.find(row => row.group.customer_id === record.id)?.value ?? null;
      });
    },

    // Optional: implementing the 'in' operator enables filtering on the relation fields.
    filterBy: {
      [Operator.In]: async (lastMessageIds, context) => {
        const records = await context.dataSource
          .getCollection('messages')
          .list({ field: 'id', operator: 'in', value: lastMessageIds }, ['customer_id']);

        return { field: 'id', operator: 'in', value: records.map(r => r.customer_id) };
      },
    },
  });

  // Use the foreign key we just created in a jointure
  collection.addRelation('lastMessage', {
    type: 'ManyToOne',
    foreignCollection: 'messages',
    foreignKey: 'lastMessageId',
  });
});
```

## Other examples

In the previous examples, we've seen how to create `OneToMany` and `ManyToOne` relationships, which are by far the more common.

You can also create `OneToOne` and `ManyToMany` relationships.

### One To One

Take note that the inverse of a `OneToOne` is a `ManyToOne`. This may seem counter-intuitive (the collection which have the `ManyToOne` relation is the one which carries the foreign key).

```javascript
agent.customizeCollection('customers', collection => {
  collection.addRelation('myPassport', {
    type: 'OneToOne',
    foreignCollection: 'passports',
    originKey: 'customer_id',
  });
});

agent.customizeCollection('passports', collection => {
  collection.addRelation('myOwner', {
    type: 'ManyToOne', // ⚠️ Not 'OneToOne'
    foreignCollection: 'customer',
    foreignKey: 'customer_id',
  });
});
```

### Many to Many

`ManyToMany` relationships use an intermediary collection to link the records.

```javascript
agent.customizeCollection('customers', collection => {
  collection.addRelation('myLanguages', {
    type: 'ManyToMany',
    foreignCollection: 'languages',
    thoughCollection: 'customerLanguages',
    originKey: 'customer_id',
    foreignKey: 'language_id',
  });
});

agent.customizeCollection('languages', collection => {
  collection.addRelation('mySpeakers', {
    type: 'ManyToMany',
    foreignCollection: 'customers',
    thoughCollection: 'customerLanguages',
    originKey: 'language_id',
    foreignKey: 'customer_id',
  });
});
```

# Under the hood

Jointure emulation work by transparently analysing the requests which are performed by the frontend and customer API in your agent, and translating them into multiple requests to the relevant data sources.

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
