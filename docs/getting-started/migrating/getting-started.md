When migrating from a previous version of the Agent, your objective is to make sure that your old agent can be substituted by the new one!

To achieve this, you have a tool at your disposal: [the `.forestadmin-schema.json` file](../../under-the-hood/forestadmin-schema.md).

This file is a JSON file that describes:

- The structure of the data that is exposed in the Forest Admin UI
- The list of customizations that you have made (actions, charts, fields, relationships, segments, ...)

The goal of the migration is to make sure that your new agent generates a `.forestadmin-schema.json` that is as similar as possible to the old one, and that you can account for the differences.

# Migration process

## For standalone agents

For standalone agents, the easier route would be to create a new temporary project using the wizard and work in a separate source tree.

You will then be able to compare the two `.forestadmin-schema.json` files, understand the differences, and port your code from one project to the other so that the schema files match.

Once that step is done, you can go ahead and replace the old agent with the new one.

This is done by stopping the old agent and changing the `.env` file of your new agent to use the same `FOREST_AUTH_SECRET` and `FOREST_ENV_SECRET` as the old agent.

Your project will then be migrated to the new agent, and you can delete both the old agent code and the temporary project that you created.

## For in-app agents

For in-app agents, the procedure is very similar to the standalone agents.

After creating a new temporary project using the wizard, you will work on making the schemas matches.

The only difference is that because both agents probably call business code from your app, you will need to have both of them living in the same source tree and Node.js process during the migration.

To do so, you will need to create your new agent with a different configuration:

```javascript
createAgent({
  // ... [other options]

  // Change mounting point to avoid conflicts
  prefix: '/new-agent',

  // Change schema path to ensure that the two agents don't overwrite each other schemas
  schemaPath: 'new-agent/.forestadmin-schema.json',

  // Change the authSecret and envSecret so that the two agents show as two different projects
  // in the Forest Admin UI
  authSecret: process.env.TEMPORARY_FOREST_AUTH_SECRET,
  envSecret: process.env.TEMPORARY_FOREST_ENV_SECRET,
});
```

<!-- FIXME add a screenshot of the UI where we show how to add the prefix in the app url -->

## Making the schemas match

Once you have both agents running, you will need to make sure that the schemas match before you can replace the old agent with the new one.

To do so, you will need to port your code from the old agent to the new one.

The process is different depending on the type of customizations that you have made.

More information about the differences between the two agents can be found in the [customization migration guide](./customizations/README.md).

# Recommendations

When migrating from a previous version of the Agent, your objective is to make sure that your old agent can be substituted by the new one.

When you start coding, you will notice that the new API allows you to do a lot more than the old one, or to use much more performant code and will be tempted to use it as you go.

We recommend that you do not do that and that you restrict yourself to shorten the migration process as much as possible.
