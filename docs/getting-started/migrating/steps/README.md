## Step 1: Run the new agent in parallel with the old one

The first step of every migration should be the creation of a temporary project using the onboarding wizard.

Follow the [dedicated guide](./run-parallel.md) to learn more about running both agents in parallel.

## Step 2: Connect the new agent to your database

Some thoughts should be given to the way you connect your new agent to your databases.

Follow the [dedicated guide](./datasource.md) to learn more about the differences between the two agents and how to connect your new agent to your databases.

## Step 3: Port your code to the new API

A translation guide for most features is available in the `Code transformations` section.

## Step 4: Ensure compatibility between agents

Making an agent which works is not enough: you also need to make sure that it generates a schema where the naming of most entities is the same as the old one.

More information is in the [dedicated guide](./compare.md)

## Step 5: Replace the old agent with the new one

Once all those steps are done, you can go ahead and replace the old agent with the new one in your development environment!

More information in this last [dedicated guide](./replace.md)
