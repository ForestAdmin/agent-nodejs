Actions can have three different scopes: Single, Bulk, and Global.

The scope of an action defines how it can be triggered and which records it will target.

| &nbsp;                                     | Single                           | Bulk                                                   | Global                                    |
| :----------------------------------------- | :------------------------------- | :----------------------------------------------------- | :---------------------------------------- |
| **Can be triggered from the list view**    | When a single record is selected | When one or more records are selected                  | ✅                                        |
| **Can be triggered from the record view**  | ✅                               | ✅                                                     | 🚫                                        |
| **Can be triggered from the summary view** | ✅                               | ✅                                                     | 🚫                                        |
| **Targeted records**                       | One at a time                    | All selected and matching the current segment / search | All matching the current segment / search |

# The `context` object

The `context` object is central to writing actions in Forest Admin.

It is the bridge between all the data that your agent has access to and the action's execution. It is passed to the `execute()` function as the first argument and provides access to the following properties:

- `getRecord()` (or `getRecords()` for bulk and global actions)
- `getRecordId()` (or `getRecordIds()` for bulk and global actions)
- `collection` the collection on which the action is declared, which can be queried using the [Forest Admin Query Interface](../../under-the-hood/queries/README.md).
- `filter` a filter that can be used to query the collection, and which is based on action scope and the list of selected records.

## Example 1: Getting data from the selected records

We can simply use the `getRecord()` method to get any column from the selected record or a relation.

```javascript
agent.customizeCollection('customers', collection =>
  collection.addAction('Call me John in the server logs', {
    scope: 'Single',
    execute: async context => {
      // use getRecords() for bulk and global actions
      const { firstName, lastName } = await context.getRecord(['firstName']);

      if (firstName === 'John') {
        console.log('Hi John!');
      } else {
        console.error('You are not John!');
      }
    },
  }),
);
```

## Example 2: Updating a field from the selected records

For simple queries, use `context.collection` and `context.filter` to query the collection.

Those are instances of objects from the Forest Admin Query Interface [(documentation)](../../under-the-hood/queries/README.md).

```javascript
agent.customizeCollection('companies', collection =>
  collection.addAction('Mark as live', {
    scope: 'Single',
    execute: async context => {
      await context.collection.update(context.filter, { live: true });
    },
  }),
);
```

## Example 3: Coding any business logic

Forest Admin does not impose any restriction on the handler: you are free to write the `execute()` handler to fit your use case.

You are free to call external APIs, query your database, or perform any work in action handlers.

```javascript
import axios from 'axios';

agent.customizeCollection('companies', collection =>
  collection.addAction('Mark as live', {
    scope: 'Single',
    execute: async context => {
      const url = 'http://my-api.com/mark-as-live';
      const params = { id: await context.getRecordId() };

      await axios.post(url, params);
    },
  }),
);
```
