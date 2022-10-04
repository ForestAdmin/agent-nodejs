Forest Admin allows to customize at a very low-level the behavior of any given collection via the usage of Collection Hooks.

{% hint style="info" %}

Collection Hooks is a very powerful feature and require special care when using it.

{% endhint %}

## How it works

As visible [here](../../under-the-hood/queries/README.md), any given collection should implement all of the following functions:

- `list`
- `create`
- `update`
- `delete`
- `aggregate`

The Collection Hooks feature allow to run any code before and/or after any of these function, providing an easy way to interact with your collections.

To declare a hook on a collection, the following informations are required:

- A hook position (`Before` | `After`)
- A hook type (`List` | `Create` | `Update` | `Delete` | `Aggregate`)
- A callback, that will receive a context matching the provided hook position and hook definition.

{% hint style="warning" %}

A single collection can have multiple hooks with the same position and the same type. They will be run in their declaration order.
Collection Hooks are only called when the collection method is contacted by the UI. This means that any usage of the Forest Admin [query interface](../../under-the-hood/queries/README.md) will not trigger them.

{% endhint %}

## Basic use-cases

In the following example, we want to prevent a set of users from updating any records of the `Transactions` table. We want to check if the user email is allowed to update a record via an external API call.

```javascript
transaction.addHook('Before', 'Update', async context => {
  // context.caller contains informations about the current user, the defined timezone, etc.
  // In this case, context.caller.email is the email used in Forest Admin by the user that initiated the call
  const isAllowed = await myFunctionToCheckIfUserIsAllowed(context.caller.email);
  if (!isAllowed) {
    // Raising an error here will prevent the execution of the update function,
    // as well as any other hooks that may be defined afterwards.
    context.throwForbiddenError(`${context.caller.email} is not allowed!`);
  }
});
```

Another good example would be the following: Each time a new `User` is created in the database, I want to send him an email.

```javascript
transaction.addHook('After', 'Create', async (context, responseBuilder) => {
  // The result of the create function always return an array of records
  const userEmail = context.records[0]?.email;
  await MyEmailSender.sendEmail({
    from: 'erlich@bachman.com',
    to: userEmail,
    message: 'Hey, a new account was created with this email.',
  });
});
```
