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
