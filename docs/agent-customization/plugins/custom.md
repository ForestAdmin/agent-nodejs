Each plugin is nothing more than an `async function` which can perform customizations at either agent level, collection level or both.

```javascript
export async function removeTimestamps(dataSource, collection, options) {
  // ... call customization methods here
}
```

Three parameters are provided:

| Name                                                                                                                                             | Description                                                                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| agent<br>([api-reference](https://forestadmin.github.io/agent-nodejs/classes/_forestadmin_datasource_customizer.DataSourceCustomizer.html))      | An object that allows customizing the whole agent. It has the same interface than the `Agent` you manipulate outside of plugins                                                                         |
| collection<br>([api-reference](https://forestadmin.github.io/agent-nodejs/classes/_forestadmin_datasource_customizer.CollectionCustomizer.html)) | An object that allows customizing the collection that the plugin was called from (null if the plugin was called on the agent). It is the same object than is passed when you call `customizeCollection` |
| options                                                                                                                                          | Options which were provided when calling the plugin                                                                                                                                                     |

## Making your plugin act differently depending on the collection

When making a plugin, you may want it to generalize to many different collections.

This can be achieved by adopting different behavior depending on the `schema` of the collection which is being targeted.

Relevant documentation:

- [DataSourceSchema](https://forestadmin.github.io/agent-nodejs/types/_forestadmin_datasource_toolkit.DataSourceSchema.html) (for plugins working on charts)
- [CollectionSchema](https://forestadmin.github.io/agent-nodejs/types/_forestadmin_datasource_toolkit.CollectionSchema.html) (for all other plugins)

```javascript
export async function removeTimestamps(agent, collection, options) {
  const fieldsToRemove = [];

  for (const collection of agent.collections) {
    if (collection.schema.fields.createdAt) collection.removeField('createdAt');
    if (collection.schema.fields.updatedAt) collection.removeField('updatedAt');
  }
}
```
