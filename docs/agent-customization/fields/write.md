Forest Admin allows to replace the field writing by your own.
It is useful when you want to overwrite a behavior or to make writable a read only field added by `addField` method.

## Disabling writes

{% hint style="info" %}
Disabling writes can be made without any code [in the field settings](https://docs.forestadmin.com/user-guide/collections/customize-your-fields#basic-settings).
{% endhint %}

```javascript
collection.replaceFieldWriting('fullName', null);
```

## Substitution

By default, he `replaceFieldWriting` function allow you to substitute any given fields by returning a patch of the current record.

In the following example, editing or creating a `fullName` will update both `firstName` and `lastName` fields of the record.


By default, he `replaceFieldWriting` function allow you to substitute any given fields by returning a patch of the current record.

In the following example, editing or creating a `fullName` will update both `firstName` and `lastName` fields of the record.


```javascript
collection.replaceFieldWriting('fullName', (value) => {
  const [firstName, lastName] = value.split(' ');

  return { firstName, lastName };
});
```

### Trigger your own code

You can also trigger any code you want without updating any field by not returning anything.

```javascript
collection.replaceFieldWriting('fullName', async (fullName) => {
  await EmailSender.send(`${fullName} wants to be update`);
});
```

### Handling relationships

{% hint style="info" %}
Handling relationships inside a `replaceFieldWriting` will only work for `Many to One` and `One to One` relationships.
{% endhint %}

In this simple example, we have two collections which are linked together:

- `Users` has a `job` and a `portfolioId` as foreignKey 
- `Portfolios` has a `title`

When the user updates his `job` field we want also update the `title` of the portfolio by the `job` name.

```javascript
collection.replaceFieldWriting('job', (job, { action }) => {
  return { job, portfolio: { title: job } };
});
```

{% hint style="info" %}
If the relationships does not exist it will create it with the given fields values.
{% endhint %}

You can also provide another `portfolioId` to update the relationships and its fields:

```javascript
collection.replaceFieldWriting('job', (job, { action }) => {
  return { job, portfolioId: 8, portfolio: { title: job } };
});
```

Of course you can chain the relationships. For example, if a portfolio has a `one to one` relationship
with the `formats` collection, you can update it by writing the right path.

```javascript
collection.replaceFieldWriting('job', (job, { action }) => {
  return { job, portfolioId: 8, portfolio: { title: job, format: { name: 'pdf' } } };
});
```

### Get the action type from the context

If you want to trigger a different code when the field is `updated` or `created`
you can use the `action` field from the `context`.

```javascript
collection.replaceFieldWriting('immutableName', (immutableName, { action }) => {
  if(action === 'create') {
    return immutableName;
  } else if (action === 'update') {
    throw new Error('immutableName can not be updated');
  }
});
```
