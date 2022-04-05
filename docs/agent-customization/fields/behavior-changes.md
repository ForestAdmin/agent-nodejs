When customizing your admin panel, instead of changing the exposed structure of your data, you may want to change the behavior of user actions.

## Write operations

### Disabling writes

```javascript

```

### Substitution

```javascript

```

## Filtering

```javascript
.replaceFieldOperator('fullName', {
  Equal: value => {
    const [firstName, ...lastNames] = value.split(' ');
    return {
      aggregation: 'and',
      conditions: [
        { field: 'firstName', operator: 'equal', value: firstName },
        { field: 'lastName', operator: 'equal', value: lastName },
      ],
    };
  },
});
```

## Sorting

Depending on the datasource, not all fields may be sortable, or you may want to change what the native sorting works.

By using the `replaceFieldSorting` method, you can change a single column's sorting behavior and replace it by something else.

### Disabling sort

Disabling sort on a field which supports it can be interesting for performance reasons on selected datasources.

```javascript
collection.replaceFieldSorting('fullName', null);
```

### Substitution

You can also provide a new sort clause which will replace the existing one. In this example we're telling forest admin "When a user sorts by fullname, I want to sort by lastName first, and then by firstName".

```javascript
collection.replaceFieldSorting('fullName', [
  { field: 'lastName', ascending: true },
  { field: 'firstName', ascending: true },
]);
```

### Emulation

{% hint style="warning" %}
Sorting emulation performance cost is **linear** with the number of records in the collection. It is a convenient way to get things working quick for collections which have a low number of records (in the thousands at most).

When used, Forest Admin will fetch the primary key and target column for the whole collection at each request, and perform the sorting inside of the NodeJS process.
{% endhint %}

Sort emulation allows to make any field automatically sortable. It will sort records by lexicographical order.

```javascript
collection.replaceFieldSorting('fullName', 'emulate');
```
