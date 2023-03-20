This project will be used to test your new agent before replacing the old one.

The only consideration that you need to take into account for this step is that you want to be able to run both agents side by side.

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
