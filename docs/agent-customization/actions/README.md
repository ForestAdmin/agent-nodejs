## What is an Action?

Sooner or later, you will need to perform actions on your data that are specific to your business. Moderating comments, generating an invoice, logging into a customer’s account or banning a user are exactly the kind of important tasks to unlock in order to manage your day-to-day operations.

On our Live Demo example, our companies collection has many examples of Action. The simplest one is "Mark as live".

## In your code

{% hint style='info' %}
In the following example, we are making queries using the [Forest Admin Query Interface](../under-the-hood/queries/README.md).

As Forest Admin does not impose any restriction on the handler, you are free to call external APIs, or query your database directly instead.
{% endhint %}

In order to create an action, you will first need to declare it in your code for a specific collection. Here we declare a Mark as Live action for the companies collection.

The action behavior is implemented in the `execute()` function.

```javascript
agent.customizeCollection('companies', collection =>
  collection.addAction('Mark as live', {
    scope: 'Single',
    execute: async (context, responseBuilder) => {
      // Change the company's status to live.
      await context.collection.update(context.filter, { status: 'live' });
    },
  }),
);
```

Note that actions can have three different scopes:

- `Single`: the action can be called only on one record at a time
- `Bulk`: the action can be called on several records at a time
- `Global`: the action available only in the list-view and is executed on all records

## In the admin panel

After declaring it, your action will appear in the "Smart actions" tab within your collection settings.

{% hint style='error' %}

An action is displayed in the UI only if:

- it is set as "visible" (see screenshot below)
  AND
- in non-development environments, the user's role must grant the "trigger" permission

{% endhint %}

You must make the action visible there if you wish users to be able to see it.

![](../../assets/actions-visibility.png)

It will then show in the actions dropdown button:

![](../../assets/actions-dropdown.png)
