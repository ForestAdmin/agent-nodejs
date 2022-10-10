---
description: Let's get you up and running on Forest Admin in minutes!
---

# Introduction

Forest Admin is a low-code internal tool solution that scales with your project. With 30+ out-of-the-box tools and pre-built UI components, you can ship an admin panel in a few minutes, and then easily customize it to meet your specific business logic. Thanks to the layout editor, non-technical team members can adjust the UI to their needs.

Forest Admin has a unique hybrid architecture - only the frontend is managed on Forest Admin servers, which gives you the flexibility of a SaaS tool without compromising on data security.

# Quick Start

Forest Admin offers a lot of flexibility in terms of installation. The following guide provides a way to start using Forest Admin in minutes. If you want to dive deeper into the installation process of the product, we got you covered [here](./install/README.md).

{% hint style='notice' %}

This guide will help you to setup Forest Admin as a standalone process, using an example Postgres database.

{% endhint %}

## Requirements

- Node.js ^14.15.0 || ^16.13.0
- NPM > 6.14.4 or yarn > 1.22.17
- If you want to use our example database, make sure Docker is installed and running

## Create an account and follow the onboarding

Go to [https://app.forestadmin.com/signup](https://app.forestadmin.com/signup), and create an account and a new project.

## Optional - Make sure you have a database running, or use our example

If you want to test Forest Admin but don't have a database on hand, here is one!

`docker run -p 5432:5432 --name forest_demo_database forestadmin/meals-database`

The associated connection string will be `postgres://lumber:secret@localhost:5432/meals`.

## Create a new JavaScript (Or TypeScript) project

Let's create a new folder and init a new JavaScript project.

```bash
mkdir ForestExample && cd ForestExample
yarn init
```

Once everything is ready, install the following dependencies.

```bash
yarn add @forestadmin/agent dotenv
```

Create an `index.js` and a `.env` file.

{% tabs %} {% tab title="index.js" %}

```javascript
require('dotenv').config();

// Import the requirements
const { createAgent } = require('@forestadmin/agent');

// Create your Forest Admin agent
createAgent({
  // These process.env variables should be provided in the onboarding
  authSecret: process.env.FOREST_AUTH_SECRET,
  envSecret: process.env.FOREST_ENV_SECRET,
  isProduction: process.env.NODE_ENV === 'production',
})
  .mountOnStandaloneServer(3000)
  .start();
```

{% endtab %} {% tab title=".env" %}

```bash
FOREST_AUTH_SECRET=<This is provided during the onboarding steps>
FOREST_ENV_SECRET=<This is provided during the onboarding steps>
NODE_ENV=development
```

{% endtab %} {% endtabs %}

Running

```bash
node index.js
```

should be enough to be redirected to the "rate-install" page. However, Forest Admin currently don't have any collections to display.

![](../assets/quickstart-no-collections.png)

## Add a datasource

Now that you are fully onboarded, the only missing part is to add a data source. Forest Admin provide a way to [create your own](../datasources/custom/README.md), but for this example we will add a [SQL Datasource](../datasources/provided/sql.md).

To install the SQL Datasource package, you can run the following command

```bash
yarn add @forestadmin/datasource-sql
```

If you run on the example database provided above, simply add the following in your `index.js` and `.env`

{% tabs %} {% tab title="index.js" %}

```javascript
const { createSqlDataSource } = require('@forestadmin/datasource-sql');

  //...
  .addDataSource(createSqlDataSource(process.env.DATABASE_URL))
  .mountOnStandaloneServer(3000)
  // ...
```

{% endtab %} {% tab title=".env" %}

```bash
DATABASE_URL=postgres://lumber:secret@localhost:5432/meals
```

{% endtab %} {% endtabs %}

If you try to run the code as is, you'll be prompted to install the `pg` driver manually.
After doing:

```bash
yarn add pg
node index.js
```

You should be able to see the following log in your terminal:

```
info: Schema was updated, sending new version
```

And refreshing the Forest Admin app should display the following screen:

![](../assets/quickstart-editor-mode.png)

Click on the "eye" icons of the collections you want to display, then exit the layout editor and ...

![](../assets/quickstart-make-collection-visible.png)

You're all set!

At the end of your onboarding, you will **out-of-the-box** be able to:

- Access all your data **(1)**
- Export your data **(2)**
- Add a record **(3)**
- View and edit a record **(4)**
- Edit your UI **(5)**
- Search and filter **(6)**

![](../assets/quick-start-abilities.png)
