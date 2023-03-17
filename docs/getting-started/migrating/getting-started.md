The new agent is built with a different architecture and breaks API retro compatibility with the legacy agents in many ways.

Migrating from a legacy agent to the new one is not a complex process, but **it cannot be done incrementally**, by running the two frameworks side by side.

When migrating from a previous version of the Agent, your objective is to make sure that your old agent can be substituted by the new one.

Customers have reported that they achieved this in a single working day, but it ultimately depends on the complexity of your project.

# Migration steps

## Step 1: Create a temporary project

The first step of every migration should be the creation of a temporary project using the onboarding wizard.

This project will be used to test your new agent before replacing the old one.

### For standalone agents

If you are migrating a standalone agent, choose the `Advanced > Microservice` option in the wizard.

Both agents will be on different source trees and Node.js processes, so you can run them side by side as long as you don't use the same port during onboarding.

### For in-app agents

If you are migrating from an in-app agent, choose the `Advanced > In-app` option in the wizard.

Because both agents probably call business code from your app, you will need to have both of them living in the same source tree and Node.js process during the migration.

To ensure that the two agents don't conflict with each other, you will need to change the following options:

```javascript
createAgent({
  // ... [other options]

  // Change mounting point
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

## Step 2: Connect the new agent to the same databases as the old one

Some thoughts should be given to the way you connect your new agent to your databases.

Follow the [dedicated guide](./datasources) to learn more about the differences between the two agents and how to connect your new agent to your databases.

## Step 3: Port customizations

More information about the differences between the two agents can be found in the [customization migration guide](./customizations).

## Step 4: Make the schemas match

To achieve this, you have a tool at your disposal: [the `.forestadmin-schema.json` file](../../under-the-hood/forestadmin-schema.md).

This file is a JSON file that describes:

- The structure of the data that is exposed in the Forest Admin UI
- The list of customizations that you have made (actions, charts, fields, relationships, segments, ...)

The goal of the migration is to make sure that your new agent generates a `.forestadmin-schema.json` that is as similar as possible to the old one, and that you can account for the differences.

Once you have both agents running, you will need to make sure that the schemas match before you can replace the old agent with the new one.

To do so, you will need to port your code from the old agent to the new one.

The process is different depending on the type of customizations that you have made.

## Step 5: Replace the old agent with the new one

Once all those steps are done, you can go ahead and replace the old agent with the new one in your development environment!

This is done by stopping the old agent and changing the configuration of your new agent so that all settings match with the old one (`URL prefix`, `port`, `envSecret` and `authSecret`).

Your project will then be migrated to the new agent, and you can delete both:

- The old agent code from your source tree
- The temporary project that you created.

# Recommendations

When migrating from a previous version of the Agent, your objective is to make sure that your old agent can be substituted by the new one.

When you start coding, you will notice that the new API allows you to do a lot more than the old one, or to use much more performant code and will be tempted to use it as you go.

We recommend that you do not do that and that you restrict yourself to shorten the migration process as much as possible.
