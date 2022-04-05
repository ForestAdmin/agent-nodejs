When customizing your admin panel, instead of changing the exposed structure of your data, you may want to override default behaviors in Forest Admin.

{% hint style="info" %}
Disabling writes or filtering can also be made readonly without any code [in the field settings](https://docs.forestadmin.com/user-guide/collections/customize-your-fields#basic-settings).
{% endhint %}

## Write operations

### Disabling writes

```javascript
collection.replaceWriting('fullName', null);
```

### Substitution

```javascript
collection.replaceWriting('fullName', (value, context) => {
  // ...
});
```

## Filtering

Filtering can be customized in many ways with Forest Admin

You may want to read about the following topics before using those features:

- [Structure of a `ConditionTree`](../../under-the-hood/queries/filters.md#examples)
- []

### Disabling Filtering

```javascript
collection.replaceFieldOperator('fullName', 'equal', null);
```

### Substitution

```javascript
collection.replaceFieldOperator('fullName', 'equal', (value, context) => {
  const [firstName, ...lastNames] = value.split(' ');

  return {
    aggregation: 'and',
    conditions: [
      { field: 'firstName', operator: 'equal', value: firstName },
      { field: 'lastName', operator: 'equal', value: lastName },
    ],
  };
});
```

### Emulation

Filtering emulation allows to make any field automatically filterable.

```javascript
collection.emulateFieldOperator('fullName', 'equal');
```

{% hint style="warning" %}
Filtering emulation performance cost is **linear** with the number of records in the collection. It is a convenient way to get things working quick for collections which have a low number of records (in the thousands at most).
{% endhint %}

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
{% endhint %}

Sort emulation allows to make any field automatically sortable. It will sort records by lexicographical order.

```javascript
collection.emulateFieldSorting('fullName');
```
