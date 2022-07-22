When building your admin panel, you will probably want to hide as much complexity to your users as you can.

This includes:

- Reducing the number of collections to the minimum
- Not exposing fields which won't be used, either because they are technical or confidential
- Using a naming convention that the user will understand, which may not match the technical names in your databases.

In this first example, we want to display the customer's city in the table-view.

However, as there is no "city" column on the "customer" database table, we need to retrieve it from the "address" relation.

```javascript
collection.importField('city', { path: 'address:city' });
```

{% hint style="info" %}
The `importField` method will automatically make it writable.
To disable write, please go to this [section](write.md).
{% endhint %}

Adding our city column into the table does bring functionality, but it created complexity.
