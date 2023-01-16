Relationships that point to a single record are displayed in the GUI as links.

Once configured, they can be used in
[charts](https://docs.forestadmin.com/user-guide/dashboards/charts),
[filters](https://docs.forestadmin.com/user-guide/getting-started/master-your-ui/the-table-view#add-one-or-several-filters),
[scopes](https://docs.forestadmin.com/user-guide/collections/scopes), and
[segments](https://docs.forestadmin.com/user-guide/collections/segments).

![Many-to-One relation in the table view](../../assets/relationships-single-link.png)

{% hint style="info" %}
Note that, for performance reasons when sorting a table-view on customizer-defined relations, Forest Admin will always use the `id` column of the related collection.
This does not apply to native relations, which are sorted by the field that is displayed on the table-view.
{% endhint %}

## Many-to-One relations

Many-to-One relations are by far the most common type of relation: many records from a collection are connected to one record in another.

Think about countries and towns: a town belongs to a single country, but each country can have multiple towns.

```javascript
agent.customizeCollection('towns', collection =>
  collection.addManyToOneRelation('myCountry', 'countries', {
    foreignKey: 'country_id',
    foreignKeyTarget: 'id', // Optional (uses `country` primary key by default)
  }),
);
```

## One-to-One relations

In a one-to-one relation, there is a one-to-one mapping between records in two collections. The relation can be unset for some records, but no record from the first collection can be linked to more than one record in the other collection.

Think about persons and passports: A person can have at most one passport, and each passport belongs to a single person.

{% hint style="warning" %}
Take note that the inverse of a `one-to-one` is a `many-to-one`.

This may seem counter-intuitive: the side of the relation which should be configured as `many-to-one` is the one that carries the foreign key.
{% endhint %}

```javascript
// Configure one side of the relation ...
agent.customizeCollection('persons', collection => {
  collection.addOneToOneRelation('myPassport', 'passports', {
    originKey: 'person_id',
    originKeyTarget: 'id', // Optional (uses `persons` primary key by default)
  });
});

// ... and the other one.
agent.customizeCollection('passports', collection => {
  // ⚠️ Not 'OneToOne'
  collection.addManyToOneRelation('myOwner', 'customer', {
    foreignKey: 'person_id',
    foreignKeyTarget: 'id', // Optional (uses `persons` primary key by default)
  });
});
```
