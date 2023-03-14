Actions can be configured to achieve different results in the GUI.

Most actions will simply perform work and display the default notification, however, other behaviors are possible:

- [Displaying a notification with a custom message](#custom-notifications)
- [Displaying HTML content in a side panel](#html-result)
- [Generating a file download](#file-generation)
- [Redirecting the user to another page](#redirections)
- [Calling a webhook from the user's browser](#webhooks) (for instance to trigger a login in a third-party application)

## Default behavior

The default behavior, when no exception is thrown in the handler is to display a generic notification.

<img src="../../assets/actions-default-success-result.png" width="300">

```javascript
agent.customizeCollection('companies', collection =>
  collection.addAction('Mark as live', {
    scope: 'Single',
    execute: async context => {
      // Not using the resultBuilder here will display the generic success notification.
      // (as long as no exception is thrown)
    },
  }),
);
```

## Custom notifications

When customizing the notification message, you can use the `resultBuilder` to generate different types of responses.

<img src="../../assets/actions-custom-success-result.png" width="300">
<img src="../../assets/actions-custom-error-result.png" width="300">

```javascript
agent.customizeCollection('companies', collection =>
  collection.addAction('Mark as live', {
    scope: 'Single',
    execute: async (context) => {
      // The resultBuilder can be used to generate different types of responses.
      if (/* ... Company is not live ... */) {
        return resultBuilder.success('Company is now live!');
      } else {
        return resultBuilder.error('The company was already live!');
      }
    },
  }),
);
```

## HTML result

You can also return an HTML page to give more feedback to the user who triggered your Action.

![](../../assets/actions-html-result-success.png)

```javascript
agent.customizeCollection('companies', collection =>
  collection.addAction('Charge credit card', {
    scope: 'Single',
    execute: async (context) => {
      /* ... charge the credit card ... */

      if (/* ... the credit card was successfully charged ... */) {
        return resultBuilder.success('Success', {
          html: `
              <p class="c-clr-1-4 l-mt l-mb">\$${record.amount / 100} USD has been successfuly charged.</p>
              <strong class="c-form__label--read c-clr-1-2">Credit card</strong>
              <p class="c-clr-1-4 l-mb">**** **** **** ${record.source.last4}</p>
            `,
        });
      } else {
        return resultBuilder.error('An error occured', {
          html: `
              <p class="c-clr-1-4 l-mt l-mb">\$${record.amount / 100} USD has not been charged.</p>
              <strong class="c-form__label--read c-clr-1-2">Credit card</strong>
              <p class="c-clr-1-4 l-mb">**** **** **** ${record.source.last4}</p>
              <strong class="c-form__label--read c-clr-1-2">Reason</strong>
              <p class="c-clr-1-4 l-mb">You can not charge this credit card. The card is marked as blocked</p>
            `,
        });
      }
    },
  }),
);
```

## File generation

{% hint style="warning" %}
Because of technical limitations, Smart Actions that generate files should be flagged as such with the `generateFile` option.

This will cause the GUI to download the output of the action, but will also prevent from being able to use the `resultBuilder` to display notifications, errors, or HTML content.
{% endhint %}

Smart actions can be used to generate or download files.

The example code below will trigger a file download (with the file named `filename.txt`, containing `StringThatWillBeInTheFile` using `text/plain` mime-type).

```javascript
collection.addAction('Download a file', {
  scope: 'Global',
  // This option is required to trigger the file download.
  generateFile: true,

  execute: async (context, resultBuilder) => {
    const random = Math.random();

    if (random < 0.33) {
      // Files can be generated from JavaScript strings.
      return resultBuilder.file('StringThatWillBeInTheFile', 'filename.txt', 'text/plain');
    } else if (random < 0.63) {
      // Or from a Buffer.
      const buffer = Buffer.from('StringThatWillBeInTheFile');
      return resultBuilder.file(buffer, 'filename.txt', 'text/plain');
    } else {
      // Or from a stream.
      const stream = fs.createReadStream('path/to/file');
      return result.builder.file(stream, 'filename.txt', 'text/plain');
    }
  },
});
```

## Redirections

To streamline your operation workflow, it could make sense to redirect to another page after an action was successfully executed.

It is possible using the `redirectTo` function.

The redirection works both for internal (`\*.forestadmin.com` pages) and external links.

{% tabs %} {% tab title="Internal link" %}

```javascript
agent.customizeCollection('companies', collection =>
  collection.addAction('Mark as live', {
    scope: 'Single',
    execute: async (context, resultBuilder) => {
      return resultBuilder.redirectTo(
        '/MyProject/MyEnvironment/MyTeam/data/20/index/record/20/108/activity',
      );
    },
  }),
);
```

{% endtab %} {% tab title="External link" %}

```javascript
agent.customizeCollection('companies', collection =>
  collection.addAction('Mark as live', {
    scope: 'Single',
    execute: async (context, resultBuilder) => {
      return resultBuilder.redirectTo(
        'https://www.royalmail.com/portal/rm/track?trackNumber=ZW924750388GB',
      );
    },
  }),
);
```

{% endtab %} {% endtabs %}

## Webhooks

After an action you can set up an HTTP (or HTTPS) callback - a webhook - to forward information to other applications.

Note that the webhook will be triggered from the user's browser, so it will be subject to CORS restrictions.

Its intended use is often to perform a login on a third-party application or to trigger a background job on the current user's behalf.

```javascript
agent.customizeCollection('companies', collection =>
  collection.addAction('Mark as live', {
    scope: 'Single',
    execute: async (context, resultBuilder) => {
      return resultBuilder.webhook(
        'http://my-company-name', // The url of the company providing the service.
        'POST', // The method you would like to use (typically a POST).
        {}, // You can add some headers if needed.
        { adminToken: 'your-admin-token' }, // A body to send to the url (only JSON supported).
      );
    },
  }),
);
```
