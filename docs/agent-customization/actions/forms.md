Very often, you will need to ask for user inputs before triggering the logic behind an action.
For example, you might want to specify a reason if you want to block a user account. Or set the amount to charge a user’s credit card.

In the following example, an action form will be displayed for the "Charge credit card" action.

```javascript
collection.addAction('Charge credit card', {
  scope: 'Bulk',
  form: [
    {
      label: 'Amount',
      description: 'The amount (USD) to charge the credit card. Example: 42.50',
      type: 'Number',
    },
    {
      label: 'description',
      description: 'Explain the reason why you want to charge manually the customer here',
      isRequired: true,
      type: 'String',
    },
    {
      label: 'stripe_id',
      isRequired: true,
      type: 'String',
    },
  ],
  execute: async (context, resultBuilder) => {
    try {
      // Add your business logic here
      return resultBuilder.success(`Amount charged!`);
    } catch (error) {
      return resultBuilder.error(`Failed to charge amount: ${error}`);
    }
  },
});
```

![](../../assets/actions-forms-charge-cc.png)

## Form entries

Here is the list of available options to customize the input form. More information can be found on our [API Reference](https://forestadmin.github.io/agent-nodejs/interfaces/_forestadmin_datasource_toolkit.ActionField.html).

| name         | type                                     | description                                                                                                                                                     |
| ------------ | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| label        | `String`                                 | Label of the input field                                                                                                                                        |
| type         | `String`                                 | The type of the field                                                                                                                                           |
| description  | `String`                                 | (optional) Add a description for your admin users to help them fill correctly your form                                                                         |
| isRequired   | `Boolean` or `ContextHandler`            | (optional) If true, your input field will be set as required in the browser. Default is false. `ContextHandler` provide an way to modify the value dynamically  |
| isReadOnly   | `Boolean` or `ContextHandler`            | (optional) If true, your input field will be set as read only in the browser. Default is false. `ContextHandler` provide an way to modify the value dynamically |
| if           | `ContextHandler`                         | (optional) Provide a way to change the visibility of the field dynamically                                                                                      |
| value        | `ContextHandler`                         | (optional) Provide a way to change the value of the field dynamically                                                                                           |
| defaultValue | Type matching `type` or `ContextHandler` | (optional) The default input value. `ContextHandler` provide an way to modify the default value dynamically                                                     |

## Typing system

The available field types are:

- Primitives: `Boolean`, `Date`, `Dateonly`, `Enum`, `Json`, `Number`, `String`
- Lists: `NumberList`, `StringList`
- Files: `File` and `FileList`
- Records from other collections: `Collection`

Note that:

- When using `Enum` or `EnumList`, your form entry must provide an additional `enumValues` key.
- When using `Collection`, your form entry must provide an additional `collectionName` key.

## Dynamic forms

Business logic often requires your forms to adapt to their context. Forest Admin makes this possible through a powerful way to extend your form's logic.
To make action form dynamic, you can use a `ContextHandler` instead of a static value on the compatible properties.

`ContextHandler` let you interact with the record or the form values to make your form dynamic.

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

### Interacting with form values

You will probably need to compute values based on the data entered by the user.

To do that, you can use the `context.formValues` object.

```javascript
// Get the value of "Amount" form field
const value = context.formValues['Amount'];
```

### Change your form's data based on previous field values

The following example takes advantage of a few `ContextHandler` properties:

```javascript
collection.addAction('Tell me a greeting', {
  scope: 'Single',
  form: [
    {
      label: 'How should we refer to you?',
      type: 'Enum',
      if: async context => {
        const person = await context.getRecord(['firstName', 'fullName']);

        return Boolean(person.firstName || person.fullName);
      },
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
  execute: async (context, resultBuilder) => {
    return resultBuilder.success(`Hello ${context.formValues['How should we refer to you?']}!`);
  },
});
```

Here, the form field `How should we refer to you?` will only be displayed if the action was triggered on a record with either a `firstName` or `fullName`.
When displayed, a widget "Dropdown" will be displayed, and the only available values are returned in the `enumValues` function.
Finally, executing the action will display a notification based on the user's choice.

### Add/remove fields dynamically

Use the `if` property of a field to allow you to hide or display it upon some logic.

```javascript
collection.addAction('Leave a review', {
  scope: 'Single',
  form: [
    {
      label: 'Rating',
      type: 'Enum',
      enumValues: ['1', '2', '3', '4', '5'],
    },
    {
      label: 'Put a comment',
      type: 'String',
      if: context => Number(context.formValues.Rating) < 4,
    },
  ],
  execute: async (context, resultBuilder) => {
    // use context.formValues to save theses informations or trigger an event.
    return resultBuilder.success(`Thank you for your review!`);
  },
});
```
