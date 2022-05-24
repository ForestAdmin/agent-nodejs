Relation that points to a single record are displayed in the frontend as links, and can be used in filters.

Once configured, the relation can used in
[charts](https://docs.forestadmin.com/user-guide/dashboards/charts),
[filters](https://docs.forestadmin.com/user-guide/getting-started/master-your-ui/the-table-view#add-one-or-several-filters),
[scopes](https://docs.forestadmin.com/user-guide/collections/scopes) and
[segments](https://docs.forestadmin.com/user-guide/collections/segments).

![Many To One relation in the table view](../../assets/relationships-single-link.png)
![Many To One relation in a filter](../../assets/relationships-single-filter.png)

## Many To One

In a many-to-one relation, many records from a collection are connected to a one record in another.

Think about `countries` and `towns`: a `town` belongs to a `country`, but `countries` can have multiple `towns`.

```javascript
agent.customizeCollection('towns', collection =>
  collection.addManyToOneRelation('myCountry', 'countries', {
    foreignKey: 'country_id',
    foreignKeyTarget: 'id', // Optional (uses `country` primary key by default)
  }),
);
```

## One To One

In a one-to-one relation, there is at most a one-to-one mapping between records in two collections (the relation can be unset for some records, but no record from the first collection can be linked to more than one record in the other).

Think about `persons` and `passports`: A `person` can have one `passport` at most, and each `passport` belong to a single `person`.

{% hint style="warning" %}
Take note that the inverse of a `OneToOne` is a `ManyToOne`.

This may seem counter-intuitive: remember that the collection which have the `ManyToOne` relation is the one which carries the foreign key.
{% endhint %}

```javascript
agent.customizeCollection('persons', collection => {
  collection.addOneToOneRelation('myPassport', 'passports', {
    originKey: 'person_id',
    originKeyTarget: 'id', // Optional (uses `persons` primary key by default)
  });
});

agent.customizeCollection('passports', collection => {
  // ⚠️ Not 'OneToOne'
  collection.addManyToOneRelation('myOwner', 'customer', {
    foreignKey: 'person_id',
    foreignKeyTarget: 'id', // Optional (uses `persons` primary key by default)
  });
});
```
