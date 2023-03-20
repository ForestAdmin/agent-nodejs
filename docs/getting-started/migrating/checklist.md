Making an agent which works is not enough: you also need to make sure that it generates a schema where the naming of most entities is the same as the old one.

The reason is that when you replace the old agent with the new one, you want to make sure that you don't lose the UI customizations that you have made:

- Roles and Scopes
- Order and visibility of fields and related data
- Summary views and Workspaces
- Segments and charts
- ...

This can happen because when saving UI customizations, collections and fields are identified by their name which may have changed between the two agents.

To ensure that this does not happen, you have a tool at your disposal: [the `.forestadmin-schema.json` file](../../under-the-hood/forestadmin-schema.md).

This file is a JSON file that describes:

- The structure of the data that is exposed in the Forest Admin UI
- The list of customizations that you have made (actions, charts, fields, relationships, segments, ...)

The goal of the migration is to make sure that your new agent generates a `.forestadmin-schema.json` that is as similar as possible to the old one, and that you can account for the differences.

Once you have both agents running, you will need to make sure that the schemas match before you can replace the old agent with the new one.

To do so, you will need to port your code from the old agent to the new one.

The process is different depending on the type of customizations that you have made.
