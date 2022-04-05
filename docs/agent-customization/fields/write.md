### Disabling writes

{% hint style="info" %}
Disabling writes can be made without any code [in the field settings](https://docs.forestadmin.com/user-guide/collections/customize-your-fields#basic-settings).
{% endhint %}

```javascript
collection.replaceWriting('fullName', null);
```

### Substitution

```javascript
collection.replaceWriting('fullName', (value, context) => {
  // ...
});
```
