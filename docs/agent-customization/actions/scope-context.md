Note that actions can have three different scopes:

- `Single`: the action can be called only on one record at a time
- `Bulk`: the action can be called on several records at a time
- `Global`: the action is available only in the list view and is executed on all records



{% hint style='info' %}
In the following example, we are making queries using the [Forest Admin Query Interface](../../under-the-hood/queries/README.md).

As Forest Admin does not impose any restriction on the handler, you are free to call external APIs or query your database directly instead.
{% endhint %}
