Note that actions can have three different scopes:

| &nbsp;                                     | Single                           | Bulk                                                   | Global                                    |
| :----------------------------------------- | :------------------------------- | :----------------------------------------------------- | :---------------------------------------- |
| **Can be triggered from the list view**    | When a single record is selected | When one or more records are selected                  | ✅                                        |
| **Can be triggered from the record view**  | ✅                               | ✅                                                     | 🚫                                        |
| **Can be triggered from the summary view** | ✅                               | ✅                                                     | 🚫                                        |
| **Targeted records**                       | One at a time                    | All selected and matching the current segment / search | All matching the current segment / search |

# The `context` object

The `context` object is central to writing actions in Forest Admin.

It is passed both to the [`execute` function](./frontend-behavior.md) of your action and when using [dynamic form customization](./forms.md#dynamic-configuration).

## Getting data from the selected records

When programming `Single` or `Bulk` actions, you'll need to interact with the selected records.

This can be done by using the `context` parameter of the `execute` function.

```javascript
agent.customizeCollection('customers', collection =>
  collection.addAction('Call me John', {
    scope: 'Single',
    execute: async (context, resultBuilder) => {
      // use getRecords() for bulk and global actions
      const { firstName, lastName } = await context.getRecord(['firstName']);

      if (firstName === 'John') {
        return resultBuilder.success('Hi John!');
      } else {
        return resultBuilder.error('You are not John!');
      }
    },
  }),
);
```

## Interacting with the records

For convenience, the `context` object provides a `collection` property and a `filter` property.

Those are documented in the [Forest Admin Query Interface](../../under-the-hood/queries/README.md).

```javascript
agent.customizeCollection('companies', collection =>
  collection.addAction('Mark as live', {
    scope: 'Single',
    execute: async (context, resultBuilder) => {
      await context.collection.update(context.filter, { live: true });
    },
  }),
);
```

## Coding your business logic

Depending on your use case, you may want to use them, or you may prefer to use your own ORM or a simple SQL query / API call.

Forest Admin does not impose any restriction on the handler: you are free to write the `execute()` handler to fit your use-case.

You are free to call external APIs, query your database, or perform any work there.

```javascript
import axios from 'axios';

agent.customizeCollection('companies', collection =>
  collection.addAction('Mark as live', {
    scope: 'Single',
    execute: async (context, resultBuilder) => {
      await axios.post('http://my-api.com/mark-as-live', {
        id: await context.getRecordId(),
      });
    },
  }),
);
```
