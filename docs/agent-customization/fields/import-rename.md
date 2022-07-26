When building your admin panel, you will probably want to hide as much complexity to your users as you can.

This includes:

- Reducing the number of collections to the minimum
- Not exposing fields which won't be used, either because they are technical or confidential
- Using a naming convention that the user will understand, which may not match the technical names in your databases.


# Moving fields

You can imports fields from [single record relationships](../relationships/single-record.md).

The imported fields will behaves as if they were on that collection.

```javascript
// Assuming the following structure:
// User    { id, firstName, lastName, addressId }
// Address { id, streetName, streetNumber, city, countryId }
// Country { id, name }

userCollection
  .importField('city', { path: 'address:city', readonly: true })
  .importField('country', { path: 'address:country:name', readonly: true })
```

{% hint style="info" %}
Note that when using `readonly: false`, the related records will be updated if the value is edited.
{% endhint %}
# Renaming and removing fields

Renaming and removing fields can be done simply by calling the `renameField` and `removeFields` methods.

```javascript
collection
  .renameField('account_v3_uuid_new', 'account')
  .removeField('password')
```

{% hint style="warning" %}
Renamed and removed fields are renamed and removed ONLY from the collections which are exposed to your admin panel.

In your code:
- Removed fields are still accessible (for instance, as dependencies to compute new fields)
- Renamed fields should still be refered by using their original name.
{% endhint %}
