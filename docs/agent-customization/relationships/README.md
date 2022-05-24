When relationships are defined during the customization step collections Forest Admin acts as if the two collections were natively linked at the datasource level.

You may have noticed that relationships within a datasource are configured out of the box, so you won't need to be defining those.

However, you may want to create additional intra-datasource and cross-datasource relationships in order to:

- Help users navigate within your admin-panel.
- Create charts which use data from multiple datasources.
- Let users filter, use scopes or segment with conditions which cross data-source boundaries.

## Minimal example

```javascript
agent.customizeCollection('towns', collection =>
  collection
    // Towns belong to countries
    .addManyToOneRelation('myCountry', 'countries', { foreignKey: 'country_id' })

    // Towns have one mayor
    .addOneToOneRelation('myMayor', 'persons', { originKey: 'mayor_id' })

    // Towns have multiple inhabitants
    .addOneToManyRelation('myMayor', 'persons', { originKey: 'town_id' })

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
