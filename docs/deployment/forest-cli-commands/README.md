# Forest CLI commands

You've seen in the previous section how [developing on Forest Admin](../) leverages our powerful **Forest CLI** to manage your UI changes.

### Installing Forest CLI

To install Forest CLI, run the following command in your terminal:

```
npm install -g forest-cli@beta
```

For further details on the package, check out [this page](https://www.npmjs.com/package/forest-cli).

### Using Forest CLI

In the following pages, we'll cover all available Forest CLI commands in details, from introduction to advanced usage. For now, there are 6 commands:

- [login](login.md)
- [init](init.md)
- [branch](branch.md)
- [switch](switch.md)
- [set-origin](set-origin.md)
- [push](push.md)
- [environments:reset](environments-reset.md)
- [deploy](deploy.md)

Some additional commands might be added in the future. In the meantime, those should be largely sufficient to manage your development workflow.

{% hint style="info" %}
Be aware that almost all commands take the `FOREST_ENV_SECRET` env variable, provided on the command or inside your _.env_ file, to know on which environment the command is run.
{% endhint %}
