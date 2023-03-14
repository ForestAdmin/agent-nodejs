Note that actions can have three different scopes:

- `Single`: the action can be called only on one record at a time
- `Bulk`: the action can be called on several records at a time
- `Global`: the action is available only in the list view and is executed on all records

{% hint style='info' %}
In the following example, we are making queries using the [Forest Admin Query Interface](../../under-the-hood/queries/README.md).

As Forest Admin does not impose any restriction on the handler, you are free to call external APIs or query your database directly instead.
{% endhint %}

### Interacting with selected records

When programming `Single` or `Bulk` actions, you'll need to interact with the selected records.

This can be done by using the `context` parameter of the `execute` function.

{% tabs %} {% tab title="Using a single action" %}

```javascript
// Get the record with the wanted field
const record = await context.getRecord(['firstName']);

// Get id of selected record
const recordId = await context.getId();
```

{% endtab %} {% tab title="Using a bulk action" %}

```javascript
// Get records with the wanted field
const records = await context.getRecords(['firstName']);

// Get ids of selected records
const recordIds = await context.getIds();
```

{% endtab %} {% endtabs %}
