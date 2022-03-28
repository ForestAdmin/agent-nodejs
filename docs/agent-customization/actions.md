## What is an Action?

Sooner or later, you will need to perform actions on your data that are specific to your business. Moderating comments, generating an invoice, logging into a customer’s account or banning a user are exactly the kind of important tasks to unlock in order to manage your day-to-day operations.
On our Live Demo example, our companies collection has many examples of Action. The simplest one is Mark as live.

## Creating an Action

In order to create an action, you will first need to declare it in your code for a specific collection. Here we declare a Mark as Live Smart action for the companies collection.

```javascript
.collection('companies', companiesCollection =>
  companiesCollection.registerAction('Mark as live', {
    scope: ActionScope.Single,
    execute: async (context, responseBuilder) => {
      return responseBuilder.success(
        `Company is now live!`,
      );
    },
  })
);
```

After declaring it, your action will appear in the Smart actions tab within your collection settings.

{% hint style='error' %}

An action is displayed in the UI only if:

- it is set as "visible" (see screenshot below)
  AND
- in non-development environments, the user's role must grant the "trigger" permission

{% endhint %}

You must make the action visible there if you wish users to be able to see it.

![](../assets/actions-visibility.png)

It will then show in the actions dropdown button:

![](../assets/actions-dropdown.png)

{% hint style='info' %}

At this point, the action only displays a notification, because no business logic handles is present.

{% endhint %}

The action behavior is implemented in the `execute` function.
In the following example, we've implemented the behavior for the Mark as live Action, which simply changes a company's status to live.

```javascript
.collection('companies', companiesCollection =>
  companiesCollection.registerAction('Mark as live', {
    scope: ActionScope.Single,
      execute: async (context, responseBuilder) => {
        await context.collection.update(context.filter, { status: 'live' });
        return responseBuilder.success('Company marked as live!');
      }
  })
);
```

## Customizing response

Action response can be configured to achieve different types of results.

### Default success notification

```javascript
return responseBuilder.success();
```

![](../assets/actions-default-success-response.png)

### Custom success notification

```javascript
return responseBuilder.success('Company is now live!');
```

![](../assets/actions-custom-success-response.png)

### Custom error notification

```javascript
return responseBuilder.error('The company was already live!');
```

![](../assets/actions-custom-error-response.png)

### Custom HTML response

You can also return a HTML page as a response to give more feedback to the admin user who has triggered your Action.

For example,

```javascript
const record = await context.getRecord();
return responseBuilder.success(
  `
  <p class="c-clr-1-4 l-mt l-mb">\$${record.amount / 100} USD has been successfuly charged.</p>
  <strong class="c-form__label--read c-clr-1-2">Credit card</strong>
  <p class="c-clr-1-4 l-mb">**** **** **** ${record.source.last4}</p>
  <strong class="c-form__label--read c-clr-1-2">Expire</strong>
  <p class="c-clr-1-4 l-mb">${record.source.exp_month}/${record.source.exp_year}</p>
  <strong class="c-form__label--read c-clr-1-2">Card type</strong>
  <p class="c-clr-1-4 l-mb">${record.source.brand}</p>
  <strong class="c-form__label--read c-clr-1-2">Country</strong>
  <p class="c-clr-1-4 l-mb">${record.source.country}</p>
  `,
  { type: 'html' },
);
```

![](../assets/actions-html-response.png)

## Setting up a webhook

After an action you can set up a HTTP (or HTTPS) callback - a webhook - to forward information to other applications.

```javascript
return responseBuilder.webhook(
  'http://my-company-name', // The url of the company providing the service.
  'POST', // The method you would like to use (typically a POST).
  {}, // You can add some headers if needed.
  { adminToken: 'your-admin-token' }, // A body to send to the url (only JSON supported).
);
```

## Downloading a file

On our Live Demo, the collection customers has an action Generate invoice. In this use case, we want to download the generated PDF invoice after clicking on the action. To indicate an action returns something to download, you have to enable the option `generateFile`.

The example code below will trigger a file download (With the file named `filename.txt`, containing `StringThatWillBeInTheFile` using `text/plain` mimetype).

```javascript
.registerAction('Download a file', {
  scope: ActionScope.Global,
  generateFile: true,
  execute: async (context, responseBuilder) => {
    return responseBuilder.file('StringThatWillBeInTheFile', 'filename.txt', 'text/plain');
  },
})
```

## Refreshing your related data

If you want to create an action accessible from the details or the summary view of a record involving related data, this section may interest you.

In the example below, the “Add new transaction” action is accessible from the summary view. This action creates a new transaction and automatically refresh the “Emitted transactions” related data section to see the new transaction.

![](../assets/actions-refresh-related.png)

```javascript
return responseBuilder.success('New transaction emitted', {
  type: 'text',
  invalidated: ['emitted_transactions'],
});
```

## Redirecting to a different page on success

To streamline your operation workflow, it could make sense to redirect to another page after a Smart action was successfully executed.

It is possible using the `redirectTo` function.

The redirection works both for internal (\*.forestadmin.com pages) and external links.

{% tabs %} {% tab title="Using an internal link to forestadmin" %}

```javascript
return responseBuilder.redirectTo(
  '/MyProject/MyEnvironment/MyTeam/data/20/index/record/20/108/activity',
);
```

{% endtab %} {% tab title="Using an external link" %}

```javascript
return responseBuilder.redirectTo(
  'https://www.royalmail.com/portal/rm/track?trackNumber=ZW924750388GB',
);
```

{% endtab %}
