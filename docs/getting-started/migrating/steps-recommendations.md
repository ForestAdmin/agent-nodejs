The new agent is built with a different architecture and breaks API retro compatibility with the legacy agents.

Migrating is not a complex process, but **it cannot be done incrementally**.
Customers have reported that they achieved this in a single working day, but it ultimately depends on the complexity of your project.

Projects which apply a few customizations to their collections will be able to migrate in a few hours, while others that heavily rely on features such as [Smart Collections](https://docs.forestadmin.com/documentation/reference-guide/smart-collections) will need more time.

# Recommendations

When migrating from a previous version of the Agent, your objective is to make sure that your old agent can be substituted by the new one.

When you start coding, you will notice that the new API allows you to do a lot more than the old one, or to use much more performant code and will be tempted to use it as you go.

For small migrations, you may as well just do that, but for big agents, we recommend shortening the migration process as much as possible by restraining yourself to the minimum amount of changes.

# Migration steps

## Step 1: Create a temporary project

The first step of every migration should be the creation of a temporary project using the onboarding wizard.

Follow the [dedicated guide](./getting-started.md) to learn more about the differences between the two agents and how to connect your new agent to your databases.

## Step 2: Connect the new agent to your database

Some thoughts should be given to the way you connect your new agent to your databases.

Follow the [dedicated guide](./datasources) to learn more about the differences between the two agents and how to connect your new agent to your databases.

## Step 3: Port your code to the new API

More information about the differences between the two agents can be found feature by feature in the [customization migration guide](./customizations).

## Step 4: Perform the verification checklist

Making an agent which works is not enough: you also need to make sure that it generates a schema where the naming of most entities is the same as the old one.

More information is in the [dedicated guide](checklist.md)

## Step 5: Replace the old agent with the new one

Once all those steps are done, you can go ahead and replace the old agent with the new one in your development environment!

This is done by stopping the old agent and changing the configuration of your new agent so that all settings match with the old one (`URL prefix`, `port`, `envSecret` and `authSecret`).

Your project will then be migrated to the new agent, and you can delete both:

- The old agent code from your source tree
- The temporary project that you created.
