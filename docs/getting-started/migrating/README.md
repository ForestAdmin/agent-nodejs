You may want to migrate from a legacy agent to this new agent. This guide will help you do so.

The new agent is built with a different architecture and breaks API retro compatibility with the legacy agents in many ways. However, because all features are available in the new agent, you can still migrate to it.

# Am I using a legacy agent?

You are using a legacy agent if you are using:

- On NodeJS: Either one of the [forest-express-sequelize](https://github.com/ForestAdmin/forest-express-sequelize) or [forest-express-mongoose](https://github.com/ForestAdmin/forest-express-mongoose) packages.
- On Rails: the [forest_liana](https://github.com/ForestAdmin/forest-rails) gem.
- On Python: the [django-forestadmin](https://github.com/ForestAdmin/django-forestadmin) package.
- On PHP: the [forestadmin/laravel-forestadmin](https://github.com/ForestAdmin/laravel-forestadmin) package.

Note that if you are using `forestadmin/laravel-forestadmin`, you may want to wait: our team is hard at work on porting this new agent architecture to PHP (the beta is already open for customers using [Symfony](https://github.com/ForestAdmin/symfony-forestadmin)).

# When to migrate?

Legacy agents are still supported, and we will continue to do so for a while.

No end-of-life date has been set yet, but it will be announced on a minimal 18 months period guarantee.

To give more visibility to our developers' community, about agent usability and support in the future, you will find [on this page](https://docs.forestadmin.com/documentation/how-tos/releases-support) the important lifecycle dates per agent stack and versions.

# Why migrate?

Breaking changes are not fun, but they are necessary to keep improving the Forest Admin product. The new agent architecture is a big step forward in terms of performance, stability, and features.

Forest Admin released its agent in 2016 when Express was the only popular web framework and typing systems were scarcer. The predominant way to do async programming then was with callbacks.

In the ecosystem of the time, the design of our Agent was sound.

- Its API had a low learning curve because it was based on Express and Sequelize/Mongoose.
- The accessibility of our API meant a bigger deal than its performance because Forest Admin customers had smaller projects – being easy to use was more important than speed.
- The company focused on a reduced number of data sources (PostgreSQL, MySQL, Microsoft SQL, MongoDB).

In the meantime, JavaScript’s ecosystem has substantially evolved, and although we could’ve introduced changes in our API at every turn, this would have greatly disturbed our customers’ daily operations.

## Agnostic to web frameworks and ORMs

This new Agent no longer cares about either the web framework or the ORM in use – it natively integrates with [Express](../install/expose/using-express.md), [Fastify](../install/expose/using-fastify.md), [Nest.js](../install/expose/using-nest.md), and [Koa](../install/expose/using-koa.md).

Customers working on other frameworks can still use the Agent by mounting it in [standalone mode](../install/expose/using-standalone.md) and by using a reverse proxy.

You can also connect to your database directly and use automatic model introspection: you will no longer need to maintain Sequelize.js models if you are using another ORM for your production app.

We still support Sequelize.js and Mongoose.js, which gives you additional benefits – such as improving code reuse from your application, even though it isn’t required anymore.

```javascript
createAgent()
  .mountOnExpress(expressApp)
  .mountOnKoa(koaApp)
  .mountOnFastify(fastifyApp)
  .mountOnNest(nestApp)
  .mountOnStandalone(3351, '0.0.0.0');
```

## Support multiple data sources

With the advent of the Software-as-a-Service (SaaS) industry, the number of data sources that you need to manage has increased.

Many apps now use specific data sources for specific features – ElasticSearch for search, Redis for caching, etc – and mix relational and non-relational databases.

With our first Agent, the paradigm was to have a single database connection, and Forest Admin released a different library for each data source type.

We now support multiple data sources in the same project: you can [connect as many as you need](../../datasources/connection/README.md), combine relational and non-relational databases, and use different ORMs for each one.

```javascript
createAgent()
  .addDataSource(createMongooseDataSource(mongooseInstance))
  .addDataSource(createSequelizeDataSource(sequelizeInstance))
  .addDataSource(createSqlDataSource('postgres://localhost:5432/my_database'));
```

You are also free to [implement your connectors](../../datasources/custom/README.md) to any data source that you want, even to your in-house APIs.

## Autocompletion and typing system

In 2016, the vast majority of projects did not use a typing system.

This is no longer the case and we adapted to that change as well: the new agent is completely written in [TypeScript](https://www.typescriptlang.org/), and [automatically generates type definitions](../install/autocompletion-and-typings.md) on the databases that are plugged into your agent.

When coding you will get autocompletion and type-checking on your models.

```console
sandro@forestadmin $ tsc
src/forest/card.ts:6:61: error TS2820
  Type '"customerId"' is not assignable to type '"id" | "is_active" | "customer_id"'.
  Did you mean '"customer_id"'?

6   collection.addManyToOneRelation('customer', 'customer', { foreignKey: 'customerId' });
                                                              ~~~~~~~~~~

Found 1 error in src/forest/card.ts:6
```

## Functional approach

We sell a product made by developers for developers.

As such, our customers have a unique understanding of the value and limits of our product, which makes their feedback more invaluable than in any other industry.

We've made a major change in the way we design our API and are now using a more functional approach: instead of having a generated codebase that you modify, you now start from an empty project and add custom behaviors by registering your logic with side-effect-free functions.

As a customer, the new [API is much higher-level](../../agent-customization/fields/README.md): you won't be dealing with low-level concepts such as "routes" or "query-string", but instead you will be dealing with "actions", "fields", and "segments".

```javascript
createAgent().customizeCollection('books', books => {
  books.addAction('Allocate ISBN number', {
    scope: 'Single',
    execute: ...
  });
});
```

## Performance

Our first customers were small startups that have grown alongside us. They now harbor dozens of collections and millions of users – we need to be able to scale with them.

Many of the performance improvements that come with this new Agent would not have been possible with the first one because of API stability.

The first Agent’s API is full of compromises between performance and accessibility. Some of those compromises are no longer relevant today, so we have decided to head in a different direction.
