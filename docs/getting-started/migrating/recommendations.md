The new agent is built with a different architecture and breaks API retro compatibility with the legacy agents.

Migrating is not a complex process, but **it cannot be done incrementally**.
Customers have reported that they achieved this in a single working day, but it ultimately depends on the complexity of your project.

Projects which apply a few customizations to their collections will be able to migrate in a few hours, while others that heavily rely on features such as [Smart Collections](https://docs.forestadmin.com/documentation/reference-guide/smart-collections) will need more time.

# Common pitfalls

## Getting stuck

If you get stuck during the migration, you can always contact our support team at [https://community.forestadmin.com/](https://community.forestadmin.com/).

Feedback about any issue you encounter during the migration process is invaluable to us, so please don't hesitate to share it.

## Premature optimizations

When migrating from a previous version of the Agent, your objective is to make sure that your old agent can be substituted by the new one.

When you start coding, you will notice that the new API allows you to use more performant code and will be tempted to use it as you go.

We recommend shortening the migration process as much as possible by restraining yourself to the minimum amount of changes.

## Testing

Once you have migrated your project, you will need to test it thoroughly to make sure that everything works as expected.
