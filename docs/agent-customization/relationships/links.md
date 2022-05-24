### Many To One

```javascript
// Link 'payments' to 'customers'
agent.customizeCollection('payments', collection =>
  collection.addManyToOneRelation('myCustomer', 'customers', {
      foreignKey: 'external_id',
      foreignKeyTarget: 'id', // Optional (uses primary key by default)
    }
  }),
);
```

{% hint style="info" %}
Note that relationships can target any unique key with `foreignKeyTarget` and `originKeyTarget`.
{% endhint %}

### One To One

Take note that the inverse of a `OneToOne` is a `ManyToOne`. This may seem counter-intuitive (the collection which have the `ManyToOne` relation is the one which carries the foreign key).

```javascript
agent.customizeCollection('customers', collection => {
  collection.addOneToOneRelation('myPassport', 'passports', {
    originKey: 'customer_id',
  });
});

agent.customizeCollection('passports', collection => {
  // ⚠️ Not 'OneToOne'
  collection.addManyToOneRelation('myOwner', 'customer', {
    foreignKey: 'customer_id',
  });
});
```
