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
