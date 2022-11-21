Depending on the data source, not all fields may be sortable, or you may want to change how the native sorting works.

By using the `replaceFieldSorting` and `emulateFieldSorting` methods, you can change a single column's sorting behavior.

### Disabling sort

Disabling sort on a field that supports it can be interesting for performance reasons.

```javascript
collection.replaceFieldSorting('fullName', null);
```

### Substitution

You can also provide replacement sort clauses. In this example, we're telling forest admin "When a user sorts by full name, I want to sort by the last name, and then by the first name".

```javascript
collection.replaceFieldSorting('fullName', [
  { field: 'lastName', ascending: true },
  { field: 'firstName', ascending: true },
]);
```

Another very common reason is performance. For instance, with auto-incrementing ids, sorting by `creationDate` is equivalent to sorting by the primary key in reverse order.

Using sort substitution where needed can save you from adding many indexes to your database.

```javascript
// Sorting by creationDate ascending === Sorting by id descending
collection.replaceFieldSorting('creationDate', [{ field: 'id', ascending: false }]);
```

### Emulation

Sort emulation allows making any field automatically sortable. It will sort records by lexicographical order.

{% hint style="warning" %}
Sorting emulation performance cost is **linear** with the number of records in the collection. It is a convenient way to get things working quickly for collections that have a low number of records (in the thousands at most).
{% endhint %}

```javascript
collection.emulateFieldSorting('fullName');
```
