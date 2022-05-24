There are three ways to add a section in the `Explorer` and `Related Data` selector of a collection.

- `OneToMany`: if towns and countries are forest admin collection, a country have multiple towns, each towns belongs to a country
- `ManyToMany`: if user, ratings and movies are forest admin collection, a user can rate many movies, a movie can be rated by many users
- `External`: Any of the above, with the difference that the linked collection is created at the same time than the relation

## One to Many

```javascript
// Link 'countries' to 'towns'
agent.customizeCollection('countries', collection =>
  collection.addOneToManyRelation('myTowns', 'towns', {
      originKey: 'country_id',
      originKeyTarget: 'id', // Optional (uses primary key by default)
    }
  }),
);
```

## Many to Many

```javascript
// Create one side of the relation
agent.customizeCollection('customers', collection => {
  collection.addManyToManyRelation('myLanguages', 'languages', 'customerLanguages', {
    originKey: 'customer_id',
    foreignKey: 'language_id',
  });
});

// Create the other side
agent.customizeCollection('languages', collection => {
  collection.addManyToManyRelation('mySpeakers', 'customers', 'customerLanguages', {
    originKey: 'language_id',
    foreignKey: 'customer_id',
  });
});
```

## External
