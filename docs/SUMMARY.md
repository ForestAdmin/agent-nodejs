‌# Summary​

- [Forest Admin](README.md)

## Getting started

- [How it works](getting-started/how-it-works.md)
- [Quick start](getting-started/quick-start.md)
- [Install](getting-started/install/README.md)

  - [On Express](getting-started/install/using-express.md)
  - [On Koa](getting-started/install/using-koa.md)
  - [On Fastify](getting-started/install/using-fastify.md)
  - [On NestJS](getting-started/install/using-nest.md)
  - [Troubleshooting](getting-started/install/troubleshooting.md)

- [Autocompletion & Typings](getting-started/autocompletion-and-typings.md)

## Data Sources

- [Usage](datasources/README.md)
- [Provided datasources](datasources/provided/README.md)
  - [SQL (without ORM)](datasources/provided/sql.md)
  - [Sequelize](datasources/provided/sequelize.md)
  - [Mongoose](datasources/provided/mongoose.md)
- [Multiple datasources](datasources/multiple-datasources/README.md)
  - [Naming conflicts](datasources/multiple-datasources/naming-conflicts.md)
  - [Relationships](datasources/multiple-datasources/relationships.md)
- [Write your own](datasources/custom/README.md)
  - [Structure declaration](datasources/custom/structure.md)
  - [Using a local cache](datasources/custom/local-cache/README.md)
    - [Read implementation](datasources/custom/local-cache/read-only.md)
    - [Write implementation](datasources/custom/local-cache/read-write.md)
  - [Using query translation](datasources/custom/query-translation/README.md)
    - [Capabilities declaration](datasources/custom/query-translation/capabilities.md)
    - [Read implementation](datasources/custom/query-translation/read-only.md)
    - [Write implementation](datasources/custom/query-translation/read-write.md)
    - [Intra-datasource Relationships](datasources/custom/query-translation/relationships.md)
  - [Contribute](datasources/contribute.md)

## Agent customization

- [Actions](agent-customization/actions/README.md)
  - [Responses](agent-customization/actions/responses.md)
  - [Forms](agent-customization/actions/forms.md)
- [Charts](agent-customization/charts.md)
- [Fields](agent-customization/fields/README.md)

  - [Add fields](agent-customization/fields/computed.md)
  - [Move, rename and delete fields](agent-customization/fields/import-rename-delete.md)
  - [Override writing behavior](agent-customization/fields/write.md)
  - [Override filtering behavior](agent-customization/fields/filter.md)
  - [Override sorting behavior](agent-customization/fields/sort.md)

- [Hooks](agent-customization/hooks/README.md)
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
- [Development workflow](deployment/development-workflow.md)
- [Using branches](deployment/using-branches.md)
- [Deploying your changes](deployment/deploying-your-changes.md)
- [Forest CLI commands](deployment/forest-cli-commands/README.md)
  - [init](deployment/forest-cli-commands/init.md)
  - [login](deployment/forest-cli-commands/login.md)
  - [branch](deployment/forest-cli-commands/branch.md)
  - [switch](deployment/forest-cli-commands/switch.md)
  - [push](deployment/forest-cli-commands/push.md)
  - [environments:reset](deployment/forest-cli-commands/environments-reset.md)
  - [deploy](deployment/forest-cli-commands/deploy.md)

## Examples

- [Upload a file to S3](agent-customization/examples/upload-file-to-s3.md)

## Under the hood

- [Data Model](under-the-hood/data-model/README.md)
  - [Typing](under-the-hood/data-model/typing.md)
  - [Relationships](under-the-hood/data-model/relationships.md)
- [Query interface](under-the-hood/queries/README.md)
  - [Fields and projections](under-the-hood/queries/fields-projections.md)
  - [Filters](under-the-hood/queries/filters.md)
  - [Aggregations](under-the-hood/queries/aggregations.md)
- [Security & Privacy](under-the-hood/security-privacy.md)
