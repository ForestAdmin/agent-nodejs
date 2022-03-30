## Opening a Smart Action Form

Very often, you will need to ask user inputs before triggering the logic behind an action.
For example, you might want to specify a reason if you want to block a user account. Or set the amount to charge a user’s credit card.

In the following example, an action form will be displayed for the "Charge credit card" action.

```javascript
.registerAction('Charge credit card', {
  scope: ActionScope.Bulk,
  form: [
    {
      label: 'Amount',
      description: 'The amount (USD) to charge the credit card. Example: 42.50',
      type: ActionFieldType.Number,
    },
    {
      label: 'description',
      description: 'Explain the reason why you want to charge manually the customer here',
      isRequired: true,
      type: ActionFieldType.String,
    },
    {
      label: 'stripe_id',
      isRequired: true,
      type: ActionFieldType.String,
    },
  ],
  execute: async (context, responseBuilder) => {
    // Add your business logic here
    try {
      return responseBuilder.success(`Amount charged!`);
    } catch (error) {
      return responseBuilder.error(`Failed to charge amount: ${error}`);
    }
  },
})
```

![](../assets/actions/actions-forms-charge-cc.png)

## Handling input values

Here is the list of available options to customize the input form. More informations can be found on our API Reference

| name        | type                          | description                                                                                                                                                     |
| ----------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| label       | `String`                      | Label of the input field                                                                                                                                        |
| type        | `PrimitiveType`               | The type of the field // @FIXME link to PrimitiveTypes doc                                                                                                      |
| description | `String`                      | (optional) Add a description for your admin users to help them fill correctly your form                                                                         |
| isRequired  | `Boolean` or `ContextHandler` | (optional) If true, your input field will be set as required in the browser. Default is false. `ContextHandler` provide an way to modify the value dynamically  |
| isReadOnly  | `Boolean` or `ContextHandler` | (optional) If true, your input field will be set as read only in the browser. Default is false. `ContextHandler` provide an way to modify the value dynamically |
| if          | `ContextHandler`              | (optional) Provide a way to change the visibility of the field dynamically                                                                                      |

| value | `ContextHandler` | (optional) Provide a way to change the value of the field dynamically |
| defaultValue | Type matching `type` or `ContextHandler` | (optional) The default input value. `ContextHandler` provide an way to modify the default value dynamically |

The following example takes advantage of a few `ContextHandler` properties:

```javascript
.registerAction('Tell me a greeting', {
  scope: ActionScope.Single,
  form: [
    {
      label: 'How should we refer to you?',
      type: ActionFieldType.Enum,
      if: async context => {
        const person = await context.getRecord(['firstName', 'lastName', 'fullName']);

        return Boolean(person.firstName || person.fullName);
      },
      defaultValue: '👋',
      enumValues: async context => {
        const person = await context.getRecord(['firstName', 'lastName', 'fullName']);

        return [
          person.firstName,
          person.fullName,
          `Mr. ${person.lastName}`,
          `Mrs. ${person.lastName}`,
          `Miss ${person.lastName}`,
        ];
      },
    },
  ],
  execute: async (context, responseBuilder) => {
    return responseBuilder.success(
      `Hello ${context.formValues['How should we refer to you?']}!`,
    );
  },
})

```

Here, the form field `How should we refer to you?` will only be displayed if the action was triggered on a record with either a `firstName` and `fullName`.
When displayed, a widget "Dropdown" will be displayed, and the only available values are returned in the `enumValues` function.
Finally, executing the action will display a notification based on the user choice.

## Interact with selected records

## Prefill a form with default values
