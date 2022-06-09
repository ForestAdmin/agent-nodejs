Forest Admin allows to customize at a very low-level the behavior of any given collection via the usage of Collection Hooks.

{% hint style="info" %}
Collection Hooks is a very powerful feature and require special care when using it.
{% endhint %}

## How it works

As visible here (@TODO), any given collection will be shipped with all of these functions:

- `list`
- `create`
- `update`
- `delete`
- `aggregate`

The Collection Hooks feature allow to run any code before and/or after any of these function, providing an easy way to interact with your collections.

Any given hook could be created using:

- A hook position (`Before` | `After`)
- A hook type (`List` | `Create` | `Update` | `Delete` | `Aggregate`)
- A callback, that will receive a context matching the provided hook position and hook definition. (A complete list of everything available in the callback argument is available here (@TODO))

## Basic use-cases

In the following example, we want to prevent a set of users from updating any records of the `Transactions` table. We want to check if the user email is allowed to update a record via an external API call.

```javascript
transaction.addHook('Before', 'Update', async context => {
  const isAllowed = await myFunctionToCheckIfUserIsAllowed(context.caller.email);
  if (!isAllowed) {
    // responseBuilder.error will raise an error, preventing the execution of the update function
    context.error(`${context.caller.email}`);
  }
});
```

Another good example would be the following: Each time a new `User` is created in my database, I want to send him an email.

```javascript
transaction.addHook('After', 'Create', async (context, responseBuilder) => {
  // The result of the create function always return an array of records
  const userEmail = context.records[0]?.email;
  await MyEmailSender.sendEmail({
    from: 'erlich@bachman.com',
    to: userEmail,
    message: 'Hey, a new account was created with this email',
  });
});
```

## Advanced use-cases
