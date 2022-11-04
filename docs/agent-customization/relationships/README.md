When relationships are defined during the customization step, Forest Admin collections act as if the two collections were natively linked at the data source level.

You may have noticed that relationships within a data source are configured out of the box, so you won't need to define those.

However, you may want to create additional intra and cross-data source relationships to:

- Help users navigate within your admin panel.
- Create charts that use data from multiple data sources.
- Let users filter, use scopes, or segment with conditions that cross data-source boundaries.

## Minimal example

```javascript
agent.customizeCollection('towns', collection =>
  collection
    // Towns belong to countries
    .addManyToOneRelation('myCountry', 'countries', { foreignKey: 'country_id' })

    // Towns have one mayor
    .addOneToOneRelation('myMayor', 'mayors', { originKey: 'town_id' })

    // Towns have multiple inhabitants
    .addOneToManyRelation('inhabitants', 'persons', { originKey: 'town_id' })

    // Towns electricity is supplied by power-plants which are shared with other towns.
    .addManyToManyRelation('myPowerPlants', 'powerPlants', 'utilityContracts', {
      originKey: 'town_id',
      foreignKey: 'powerplant_id',
    })

    // Towns have a list of honorary citizen which can be retrieved through a public API
    .addExternalRelation('honoraryCitizen', {
      schema: { firstName: 'String', lastName: 'String' },
      listRecords: async ({ id }) => {
        const response = await axios.get(`https://api.mytown.com/cities/${id}/honorary-citizen`);
        return response.body;
      },
    }),
);
```
