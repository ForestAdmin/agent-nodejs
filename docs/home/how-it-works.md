# How it works

Before you start writing a single line of code, it’s a good idea to get an overview of how Forest Admin works. The magic lies in its architecture.&#x20;

Forest Admin provides you with:

- An API hosted on your server to retrieve your data. We call it the **Admin Backend**
  - if you chose a database as a datasource (PostgreSQLL, MySQL, MSSQL, MongoDB), your Admin Backend will be generated as a **standalone folder**.
  - if you chose an existing app as a datasource (Rails, Django, Express/Sequelize, Express/Mongoose), your Admin Backend will be generated **within your app**.
- A user interface to access and manage your data from your browser. This **Forest Admin User Interface** is built and managed through ressources hosted on Forest Admin's servers.

![The Admin Backend is a Node.JS REST API hosted on your servers](../assets/Base.png)

{% hint style="info" %}
For a more in-depth explanation of Forest Admin's architecture (the Node.JS agent version), please read the [following article](https://medium.com/forest-admin/a-deep-dive-into-forest-admins-architecture-and-its-benefits-for-the-developers-who-trust-it-1d49212fb4b).
{% endhint %}

## The Admin Backend

The Admin Backend is generated upon install and **hosted on your end**.

It includes an API allowing to **translate calls made from the Forest Admin UI into queries** to your database (covering actions such as CRUD, search & filters, pagination, sorting, etc.).

It also provides the Forest Admin servers with the information needed to build the User Interface (the **Forest Admin Schema**). This information includes table names, column names and types, and relationships. It is sent when you run your Admin Backend within a file called `forestadmin-schema.json`.
