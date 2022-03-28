‌# Summary​

- [Forest Admin](README.md)

## Getting started

- [How it works](getting-started/how-it-works.md)
- [Quick start](getting-started/quick-start.md)

## Connectors

- [Usage](connectors/README.md)
- [Relationships](connectors/relationships.md)
- [Provided connectors](connectors/provided/README.md)

  - [Databases](connectors/provided/databases/README.md)
    - [SQL](connectors/provided/databases/sql.md)
  - [Object Relational Mappers](connectors/provided/orm/README.md)
    - [Sequelize](connectors/provided/orm/sequelize.md)
    - [Mongoose](connectors/provided/orm/mongoose.md)
  - [SaaS](connectors/provided/saas/README.md)
    - [Intercom](connectors/provided/saas/intercom.md)
    - [Stripe](connectors/provided/saas/stripe.md)

- [Write your own](connectors/custom/README.md)
  - [Structure declaration](connectors/custom/structure.md)
  - [Using a local cache](connectors/custom/local-cache/README.md)
    - [Read implementation](connectors/custom/local-cache/read-only.md)
    - [Write implementation](connectors/custom/local-cache/read-write.md)
  - [Using query translation](connectors/custom/query-translation/README.md)
    - [Understanding filters](connectors/custom/query-translation/filters.md)
    - [Understanding projections](connectors/custom/query-translation/projections.md)
    - [Understanding aggregations](connectors/custom/query-translation/aggregations.md)
    - [Capabilities declaration](connectors/custom/query-translation/capabilities.md)
    - [Read implementation](connectors/custom/query-translation/read-only.md)
    - [Write implementation](connectors/custom/query-translation/read-write.md)
  - [Implementing relationships](connectors/custom/relationships.md)
  - [Contribute](connectors/contribute.md)

## Agent customization

- [Actions](agent-customization/actions.md)
- [Charts](agent-customization/charts.md)
- [Fields](agent-customization/fields.md)
- [Hooks](agent-customization/hooks.md)
- [Segments](agent-customization/segments.md)

## Frontend customization

- [Smart Charts](frontend-customization/smart-charts/README.md)

  - [Create a table chart](frontend-customization/smart-charts/create-a-table-chart.md)
  - [Create a bar chart](frontend-customization/smart-charts/create-a-bar-chart.md)
  - [Create a density map](frontend-customization/smart-charts/create-a-density-map.md)
  - [Create a cohort chart](frontend-customization/smart-charts/create-a-cohort-chart.md)

- [Smart Views](frontend-customization/smart-views/README.md)
  - [Create a Map view](frontend-customization/smart-views/create-a-map-view.md)
  - [Create a Calendar view](frontend-customization/smart-views/create-a-calendar-view.md)
  - [Create a Shipping view](frontend-customization/smart-views/create-a-shipping-view.md)
  - [Create a Gallery view](frontend-customization/smart-views/create-a-gallery-view.md)
  - [Create a custom tinder-like validation view](frontend-customization/smart-views/create-a-custom-tinder-like-validation-view.md)
  - [Create a dynamic calendar view for an event-booking use case](frontend-customization/smart-views/create-a-dynamic-calendar-view-for-an-event-booking-use-case.md)
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

## Maintenance

- [Logging](maintenance/logging.md)
- [Performance](maintenance/performance.md)

## Under the hood

- [Security & Privacy](under-the-hood/security-privacy.md)
