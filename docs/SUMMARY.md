‌# Summary​

- [Forest Admin](README.md)

## Getting started

- [How it works](getting-started/how-it-works.md)
- [Quick start](getting-started/quick-start.md)
- [Install](getting-started/install/README.md)

  - [Create your agent](getting-started/install/create-your-agent.md)
  - Expose an HTTP endpoint
    - [For standalone agents](getting-started/install/expose/using-standalone.md)
    - [On Express](getting-started/install/expose/using-express.md)
    - [On Koa](getting-started/install/expose/using-koa.md)
    - [On Fastify](getting-started/install/expose/using-fastify.md)
    - [On NestJS](getting-started/install/expose/using-nest.md)
  - [Autocompletion & Typings](getting-started/install/autocompletion-and-typings.md)
  - [Troubleshooting](getting-started/install/troubleshooting.md)

- [Migrating from legacy agents](getting-started/migrating/README.md)
  - [Getting started](getting-started/migrating/getting-started.md)
  - [Connecting data sources](getting-started/migrating/datasources.md)
  - [Porting customizations](getting-started/migrating/customizations/README.md)
    - [Smart Actions](getting-started/migrating/customizations/smart-actions.md)
    - [Smart Charts](getting-started/migrating/customizations/smart-charts.md)
    - [Smart Collections](getting-started/migrating/customizations/smart-collections.md)
    - [Smart Fields](getting-started/migrating/customizations/smart-fields.md)
    - [Smart Relationships](getting-started/migrating/customizations/smart-relationships.md)
    - [Smart Segments](getting-started/migrating/customizations/smart-segments.md)
    - [Route overrides](getting-started/migrating/customizations/route-overrides.md)

## Data Sources

- [Connecting data sources](datasources/connection/README.md)
  - [Collection selection](datasources/connection/partial-imports.md)
  - [Naming conflicts](datasources/connection/naming-conflicts.md)
  - [Cross-data source relationships](datasources/connection/relationships.md)
- Provided data sources
  - [SQL (without ORM)](datasources/provided/sql.md)
  - [Sequelize](datasources/provided/sequelize.md)
  - [Mongoose](datasources/provided/mongoose.md)
- [Write your own](datasources/custom/README.md)
  - [Structure declaration](datasources/custom/structure.md)
  - [Capabilities declaration](datasources/custom/capabilities.md)
  - [Read implementation](datasources/custom/read-only.md)
  - [Write implementation](datasources/custom/read-write.md)
  - [Intra-data source Relationships](datasources/custom/relationships.md)
  - [Contribute](datasources/contribute.md)

## Agent customization

- [Getting Started](agent-customization/README.md)
- [Actions](agent-customization/actions/README.md)
  - [Scope and context](agent-customization/actions/scope-context.md)
  - [Result builder](agent-customization/actions/result-builder.md)
  - [Forms](agent-customization/actions/forms.md)
  - [Related data invalidation](agent-customization/actions/related-data-invalidation.md)
- [Charts](agent-customization/charts/README.md)

  - [Value](agent-customization/charts/value.md)
  - [Objective](agent-customization/charts/objective.md)
  - [Percentage](agent-customization/charts/percentage.md)
  - [Distribution](agent-customization/charts/distribution.md)
  - [Leaderboard](agent-customization/charts/leaderboard.md)
  - [Time-based](agent-customization/charts/time.md)

- [Fields](agent-customization/fields/README.md)

  - [Add fields](agent-customization/fields/computed.md)
  - [Move, rename and delete fields](agent-customization/fields/import-rename-delete.md)
  - [Override writing behavior](agent-customization/fields/write.md)
  - [Override filtering behavior](agent-customization/fields/filter.md)
  - [Override sorting behavior](agent-customization/fields/sort.md)
  - [Validation](agent-customization/fields/validation.md)

- [Hooks](agent-customization/hooks/README.md)
- [Plugins](agent-customization/plugins/README.md)

  - Provided plugins
    - [AWS S3](agent-customization/plugins/provided/aws-s3.md)
    - [Advanced Export](agent-customization/plugins/provided/export-advanced.md)
    - [Flattener](agent-customization/plugins/provided/flattener.md)
  - [Write your own](agent-customization/plugins/custom.md)

- [Relationships](agent-customization/relationships/README.md)
  - [To a single record](agent-customization/relationships/single-record.md)
  - [To multiple records](agent-customization/relationships/multiple-records.md)
  - [Computed foreign keys](agent-customization/relationships/computed-fks.md)
  - [Under the hood](agent-customization/relationships/under-the-hood.md)
- [Search](agent-customization/search.md)
- [Segments](agent-customization/segments.md)

## Frontend customization

- [Smart Charts](frontend-customization/smart-charts/README.md)

  - [Create a table chart](frontend-customization/smart-charts/create-a-table-chart.md)
  - [Create a bar chart](frontend-customization/smart-charts/create-a-bar-chart.md)
  - [Create a cohort chart](frontend-customization/smart-charts/create-a-cohort-chart.md)
  - [Create a density map](frontend-customization/smart-charts/create-a-density-map.md)

- [Smart Views](frontend-customization/smart-views/README.md)
  - [Create a Map view](frontend-customization/smart-views/create-a-map-view.md)
  - [Create a Calendar view](frontend-customization/smart-views/create-a-calendar-view.md)
  - [Create a Shipping view](frontend-customization/smart-views/create-a-shipping-view.md)
  - [Create a Gallery view](frontend-customization/smart-views/create-a-gallery-view.md)
  - [Create a custom tinder-like validation view](frontend-customization/smart-views/create-a-custom-tinder-like-validation-view.md)
  - [Create a custom moderation view](frontend-customization/smart-views/create-a-custom-moderation-view.md)

## Deploying to production

- [Environments](deployment/environments.md)
  - [Deploy on Heroku](deployment/cloud/deploy-on-heroku.md)
  - [Deploy on GCP](deployment/cloud/deploy-on-gcp.md)
  - [Deploy on Ubuntu](deployment/cloud/deploy-on-ubuntu.md)
- [Development workflow](deployment/development-workflow.md)
- [Using branches](deployment/using-branches.md)
- [Deploying your changes](deployment/deploying-your-changes.md)
- [Forest CLI commands](deployment/forest-cli-commands/README.md)
  - [init](deployment/forest-cli-commands/init.md)
  - [login](deployment/forest-cli-commands/login.md)
  - [branch](deployment/forest-cli-commands/branch.md)
  - [switch](deployment/forest-cli-commands/switch.md)
  - [set-origin](deployment/forest-cli-commands/set-origin.md)
  - [push](deployment/forest-cli-commands/push.md)
  - [environments:reset](deployment/forest-cli-commands/environments-reset.md)
  - [deploy](deployment/forest-cli-commands/deploy.md)

## Under the hood

- [.forestadmin-schema.json](under-the-hood/forestadmin-schema.md)
- [Data Model](under-the-hood/data-model)
  - [Typing](under-the-hood/data-model/typing.md)
  - [Relationships](under-the-hood/data-model/relationships.md)
- [Query interface](under-the-hood/queries/README.md)
  - [Fields and projections](under-the-hood/queries/fields-projections.md)
  - [Filters](under-the-hood/queries/filters.md)
  - [Aggregations](under-the-hood/queries/aggregations.md)
- [Security & Privacy](under-the-hood/security-privacy.md)
