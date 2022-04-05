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

Filtering can be customized in many ways with Forest Admin.

The customization API works by operator, you may want to read about the following topics before using those features:

- [Unlocking filtering, scopes and segments on the GUI](./../../datasources/custom/query-translation/capabilities.md#unlock-filtering-scopes-and-segments-on-gui)
- [Structure of a `ConditionTree`](../../under-the-hood/queries/filters.md#examples)
- [List of all filtering Operators](../../under-the-hood/queries/filters.md#operators)
- [Operator equivalence system](../../under-the-hood/queries/filters.md#operator-equivalence)

### Disabling operators

Disabling filtering on a field which supports it can be interesting for performance reasons.

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

By using the `replaceFieldSorting` and `emulateFieldSorting` methods, you can change a single column's sorting behavior.

### Disabling sort

Disabling sort on a field which supports it can be interesting for performance reasons.

```javascript
collection.replaceFieldSorting('fullName', null);
```

### Substitution

You can also provide replacement sort clauses. In this example we're telling forest admin "When a user sorts by fullname, I want to sort by lastName first, and then by firstName".

```javascript
collection.replaceFieldSorting('fullName', [
  { field: 'lastName', ascending: true },
  { field: 'firstName', ascending: true },
]);
```

Another very common reason is performance. For instance, with auto incrementing ids, sorting by `creationDate` is equivalent to sorting by the primary key in reverse order.

Using sort substitution where needed can save you from adding many indexes on your database.

```javascript
// Sorting by creationDate ascending === Sorting by id descending
collection.replaceFieldSorting('creationDate', [{ field: 'id', ascending: false }]);
```

### Emulation

{% hint style="warning" %}
Sorting emulation performance cost is **linear** with the number of records in the collection. It is a convenient way to get things working quick for collections which have a low number of records (in the thousands at most).
{% endhint %}

Sort emulation allows to make any field automatically sortable. It will sort records by lexicographical order.

```javascript
collection.emulateFieldSorting('fullName');
```
