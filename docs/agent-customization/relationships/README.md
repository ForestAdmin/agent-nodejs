When relationships are defined during the customization step collections Forest Admin acts as if the two collections were natively linked at the datasource level.

You may have noticed that relationships within a datasource are configured out of the box, so you won't need to be defining those.

However, you may want to create additional intra-datasource and cross-datasource relationships in order to:

- Help users navigate within your admin-panel.
- Create charts which use data from multiple datasources.
- Let users filter, use scopes or segment with conditions which cross data-source boundaries.

## Display

| Name                | Visible in           | Definition                                                                 | Example                                                                          |
| ------------------- | -------------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `OneToMany`         | Related Data         | One record in a collection is connected to multiple records in another     | A country can have multiple cities, but cities belong to a country               |
| `OneToManyEmbedded` | Related Data         |                                                                            |                                                                                  |
| `ManyToMany`        | Related Data         | Many records from a collection are connected to many records in another    | A user can rate many movies, and a movie can be rated by many users              |
| `ManyToOne`         | List and Detail view | Many records from a collection are connected to a single record in another | A city belongs to a country, but countries can have multiple cities              |
| `OneToOne`          | List and Detail view | There is a one-to-one mapping between records in two collections           | A person can have only one passport, and each passport belong to a single person |
