Forest Admin is a low-code internal tool solution that scales with your project. With 30+ out-of-the-box tools and pre-built UI components, you can ship an admin panel in a few minutes, and then easily customise it to meet your specific business logic. Thanks to the layout editor, non-technical team members can adjust the UI to their needs.

Forest Admin has a unique hybrid architecture - only the frontend is managed on Forest Admin servers, which gives you the flexibility of a SaaS tool without compromising on data security.

## Standalone and In-app installation

The Forest Admin agent can run as a Standalone server, but can also be "attached" to an existing Node.js application server (That we usually call In-app).

Usually, we recommand to install the Forest Admin agent "In-app", as our [Development and Deployment workflow](../../deployment/) is strongly tied to you application.

However, if you don't already have an existing Node.js application, or if you prefer to run Forest Admin in an isolated context, you can still use our Standalone installation process.

{% hint style="info" %}

The installation process will ask for your application endpoint. This endpoint must be correctly filled in order to onboard successfully. It is also required for the authentication process to work as expected. If you choose to make the agent independant of your main application, fill this endpoint with then endpoint you would like (http://localhost:3000 by default).

{% endhint %}

## Requirements

In order to install Forest Admin in a Javascript or Typescript environment, you'll need to install the `@forestadmin/agent@beta` package. It expose all the code required to create a Forest Admin agent.

You will also need to install at least one of [our datasource](../../datasources/README.md) package.

If you don't use it already, you can also install [dotenv](https://github.com/motdotla/dotenv), which ease the management of environment variables. Even though it is not mandatory for Forest Admin to run, the example provided in the following documentations will use it.

The following sections will provide example to ease your installation process. All of them will show how to run the agent using an SQL datasource.

{% hint style="info" %}
If you want to test Forest Admin but don't have a database on hand, here is one!

`docker run -p 5432:5432 --name forest_demo_database forestadmin/meals-database`

The associated connection string will be `postgres://lumber:secret@localhost:5432/meals`
{% endhint %}
