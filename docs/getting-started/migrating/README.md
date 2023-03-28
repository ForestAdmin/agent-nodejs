You may want to migrate from a legacy agent to this new agent. This guide will help you do so.

The new agent is built with a different architecture and breaks API retro compatibility with the legacy agents in many ways. However, because all features are available in the new agent, you can still migrate to it.

# Am I using a legacy agent?

You are using a legacy agent if you are using:

- On NodeJS: Either one of the [forest-express-sequelize](https://github.com/ForestAdmin/forest-express-sequelize) or [forest-express-mongoose](https://github.com/ForestAdmin/forest-express-mongoose) packages.
- On Rails: the [forest_liana](https://github.com/ForestAdmin/forest-rails) gem.
- On Python: the [django-forestadmin](https://github.com/ForestAdmin/django-forestadmin) package.
- On PHP: the [forestadmin/laravel-forestadmin](https://github.com/ForestAdmin/laravel-forestadmin) package.

Note that if you are using Rails, Python or PHP, you will want to wait!

Our team is currently porting this new agent architecture to all stacks supported by Forest Admin (the beta is already open for customers using [Symfony](https://github.com/ForestAdmin/symfony-forestadmin)).

# When to migrate?

Legacy agents are still supported and will continue to be for a while.

No end-of-life date has been set yet for customers using the latest major version of the legacy agents, but it will be announced on a minimal 18 months period guarantee.

To give more visibility to our developers' community, about agent usability and support in the future, you will find [on this page](https://docs.forestadmin.com/documentation/how-tos/releases-support) the important lifecycle dates per agent stack and versions.

# Missing features

The new agent brings a lot of new features, but a small subset of what was available in the legacy agents is not yet there.

## SQL Charts

![SQL Chart configuration screen](../../assets/migration-chart-sql.png)

[SQL Charts](https://docs.forestadmin.com/user-guide/dashboards/charts/create-a-chart#creating-a-chart-with-sql) allowed the creation of charts from SQL queries from the UI.

In the new agent, building a chart from SQL queries is only possible [through code](../../agent-customization/charts/README.md).

Because the new agent no longer exposes the nature of the underlying database, this feature was not ported into the new agent.

Due to popular demand, it is planned to be reintroduced in a future version of the agent, but we don't have a timeline for it yet.
