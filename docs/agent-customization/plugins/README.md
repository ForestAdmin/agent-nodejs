When customizing collections, it can be quite common to need to perform the same tasks on multiple fields and collections.

Plugins are the answer to that need, and you are strongly encouraged to use them everywhere you notice that your customization files could benefit from code factorization.

## Minimal example

### Using plugins

Plugins are used by either importing a module, or installing the relevant package, and then calling the `.use()` method.

Depending on the plugin, options may be provided.

```javascript
import { createAgent } from '@forestadmin/agent';
import { createFileField } from '@forestadmin/plugin-s3';
import { removeTimestamps } from './plugins/remove-timestamps';

// The .use() method can be called both on the agent and on collections.
createAgent()
  // Some plugins do not require options
  .use(removeTimestamps)

  // Others do
  .customizeCollection('accounts', collection =>
    collection.use(createFileField, { fieldname: 'avatar' }),
  );
```

### Writing plugins

A plugin is nothing more than an `async function` that performs customizations.

The full documentation can be found in the ["Write your own plugin" section](./custom.md).

```javascript
export async function removeTimestamps(dataSource, collection) {
  // Allow the plugin to be used both on the dataSource or on individual collections
  const collections = collection ? [collection] : dataSource.collections;

  // Remove fields
  for (const currentCollection of collections) {
    currentCollection.removeField('createdAt');
    currentCollection.removeField('updatedAt');
  }
}
```
