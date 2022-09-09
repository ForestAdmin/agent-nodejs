## Standalone vs In-app installation

The Forest Admin agent can run as a Standalone server (You can see it in action in the [quickstart](../quick-start.md)), but can also be "attached" to an existing Node.js application server (That we usually call In-app).

We recommend to install the Forest Admin agent "In-app" whenever it's possible, as our [Development and Deployment workflow](../../deployment/) can be tied to your application deployment process.

However, if you don't already have an existing Node.js application, or if you prefer to run Forest Admin in an isolated context, you can still use our [Standalone](../quick-start.md) installation.

{% hint style="info" %}

The installation process will ask for your application endpoint. This endpoint must be correctly filled in order to onboard and to make the authentication process to work as expected. If you choose to make the agent run as Standalone process, fill it with the endpoint you would like your agent to run on (http://localhost:3000 by default) and make sure that the port provided to `mountAsStandaloneServer` matches (3000). <!-- markdown-link-check-disable-line -->

{% endhint %}

## Requirements

In order to install Forest Admin in a Javascript or Typescript environment, you'll need to install the `@forestadmin/agent@beta` package. It exposes all the code required to create a Forest Admin agent.

You will also need to install at least one of [our data source](../../datasources/README.md) package.

If you don't use it already, you can also install [dotenv](https://github.com/motdotla/dotenv), which ease the management of environment variables. Even though it is not mandatory for Forest Admin to run, the example provided in the following documentations will use it.

The following sections will provide example to ease your installation process. All of them will show how to run the agent using an SQL data source on our supported application servers.
