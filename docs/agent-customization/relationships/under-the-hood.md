Join emulation work by transparently analyzing the requests which are performed by the frontend and customer API in your agent, and translating them into multiple requests to the relevant data sources.

For instance, assuming that:

- You defined a jointure between two collections: `books` and `authors`
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

The request will be transparently split and its result merged to produce the same output as if the original query was run.

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

In this simple example, it is a straightforward three-step process, but the feature can come at the cost of performance on more complex queries.
{% endhint %}
