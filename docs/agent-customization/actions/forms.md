Very often, you will need to ask for user inputs before triggering the logic behind an action.
For example, you might want to specify a reason if you want to block a user account. Or set the amount to charge a user’s credit card.

In the following example, an action form will be displayed for the "Charge credit card" action.

![Action form displayed on Forest Admin](../../assets/actions-forms-charge-cc.png)

```javascript
agent.customizeCollection('customer', collection => {
  collection.addAction('Charge credit card', {
    scope: 'Single',
    form: [
      {
        label: 'amount',
        description: 'The amount (USD) to charge the credit card. Example: 42.50',
        type: 'Number',
        isRequired: true,
      },
      {
        label: 'description',
        description: 'Explain the reason why you want to charge manually the customer here',
        type: 'String',

        // The description field is only required if the amount is greater than $100.
        // This is an example of conditional configuration, see below for more information.
        isRequired: context => context.formValues.Amount > 100,
      },
    ],
    execute: async (context, resultBuilder) => {
      try {
        // Retrieve columns from the selected customer, and values entered in the form.
        const { stripeId, address } = await context.getRecord(['stripeId', 'address:country']);
        const { amount, description } = context.formValues;

        /* ... Charge the credit card here ... */

        return resultBuilder.success(`Amount charged!`);
      } catch (error) {
        return resultBuilder.error(`Failed to charge amount: ${error}`);
      }
    },
  });
});
```

# Form fields configuration

{% hint style='info' %}
More information about the `ActionField` type can be found on our [API Reference](https://forestadmin.github.io/agent-nodejs/interfaces/_forestadmin_datasource_toolkit.ActionField.html).
{% endhint %}

## Static configuration

Form fields are statically configurable using the `label`, `type`, `description`, `isRequired` and `isReadOnly` properties.

```javascript
agent.customizeCollection('customer', collection => {
  collection.addAction('Charge credit card', {
    form: [
      {
        /**
         * This value will serve both as the label and the name of the input field.
         * When submitted, the value will be available in `context.formValues['amount']`
         */
        label: 'amount',

        /**
         * The type of the field.
         *
         * The available types are:
         * - Primitives: `Boolean`, `Date`, `Dateonly`, `Enum`, `Json`, `Number`, `String`
         * - Lists: `NumberList`, `EnumList`, `StringList`
         * - Files: `File` and `FileList`
         * - Records from other collections: `Collection`
         */
        type: 'Number',

        /**
         * Provide possible values (only when using type: 'Enum' or type: 'EnumList')
         */
        enumValues: ['value1', 'value2', 'value3'],

        /**
         * Provide the name of the collection (only when using type: 'Collection')
         */
        collectionName: 'customer',

        /**
         * Add a description for your admin users to help them fill correctly your form.
         * (optional, no default value)
         */
        description: 'The amount (USD) to charge the credit card. Example: 42.50',

        /**
         * If true, your input field will be set as required in the browser.
         * (optional, default: false)
         */
        isRequired: true,

        /**
         * If true, your input field will be set as read only in the browser.
         * (optional, default: false)
         */
        isReadOnly: false,

        /**
         * The default input value
         * (optional, no default value)
         */
        defaultValue: 150,
      },
    ],
  });
});
```

## Dynamic configuration

Business logic often requires your forms to adapt to their context. Forest Admin makes this possible through a powerful way to extend your form's logic.

To make an action form dynamic, simply use functions instead of a static value on the compatible properties.
Both synchronous and asynchronous functions are supported, and they take the [same context object](./scope-context.md) as the one provided to the `execute()` handler.

This can be done for the following properties:

- Available as static configuration: `isRequired`, `isReadOnly`, `defaultValue`, `enumValues`, `collectionName`
- Additional properties: `if`, `value`

```javascript
agent.customizeCollection('customer', collection => {
  collection.addAction('Charge credit card', {
    form: [
      {
        /** See documentation above */
        label: 'amount',
        type: 'Number',

        /**
         * The field will only be displayed if the function returns true.
         * (optional, no default value)
         */
        if: context => context.formValues['...'] !== '...',

        /**
         * Change the current value of the field.
         * (optional, no default value)
         */
        value: context => {
          if (context.formValues['amount'] > 1000) {
            // The amount is too high, let's set the field to a lower value.
            return 500;
          } else {
            return context.formValues['amount'];
          }
        },
      },
    ],
    execute: async context => {
      /* ... */
    },
  });
});
```

### Example 1: Conditional field display based on record data

Success on social media can be based on the quality of your content but regardless on how hard you try, you will never be able to please everyone.

A good way to improve the mood is to ask only users which like your media to leave a review!

Here is how to do it in Forest Admin:

```javascript
agent.customizeCollection('product', collection => {
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

        // Only display this field if the rating is 4 or 5
        if: context => Number(context.formValues.Rating) >= 4,
      },
    ],
    execute: async context => {
      /* ... perform work here ... */
    },
  });
});
```

### Example 2: Conditional enum values based on both record data and form values

In this example, the form will display a different set of enum values depending on both the record data and the value of the form field.

The first field displays different denominations that can be used to address the customer, depending on the full name and gender of the customer.

The second field displays different levels of loudness depending on if the customer is Morgan Freeman, as to ensure that we never speak `Very Loudly` at him, for the sake of politeness.

```javascript
agent.customizeCollection('customer', collection => {
  collection.addAction('Tell me a greeting', {
    scope: 'Single',
    form: [
      {
        label: 'How should we refer to you?',
        type: 'Enum',
        enumValues: async context => {
          // Enum values are computed based on the record data
          // Becase we need to fetch the record data, we need to use an async function
          const person = await context.getRecord(['firstName', 'lastName', 'gender']);
          const base = [person.firstName, `${person.firstName} ${person.lastName}`];

          if (gender === 'Female') {
            return [...base, `Mrs. ${person.lastName}`, `Miss ${person.lastName}`];
          } else {
            return [...base, `Mr. ${person.lastName}`];
          }
        },
      },
      {
        label: 'How loud should we say it?',
        type: 'Enum',
        enumValues: context => {
          // Enum values are computed based on another form field value
          // (no need to use an async function here, but doing so would not be a problem)
          const denomination = context.formValues['How should we refer to you?'];

          return denomination === 'Morgan Freeman'
            ? ['Whispering', 'Softly', 'Loudly']
            : ['Softly', 'Loudly', 'Very Loudly'];
        },
      },
    ],
    execute: async (context, resultBuilder) => {
      const denomination = context.formValues['How should we refer to you?'];
      const loudness = context.formValues['How loud should we say it?'];

      let text = `Hello ${denomination}`;
      if (loudness === 'Whispering') {
        text = text.toLowerCase();
      } else if (loudness === 'Loudly') {
        text = text.toUpperCase();
      } else if (loudness === 'Very Loudly') {
        text = text.toUpperCase() + '!!!';
      }

      return resultBuilder.success(text);
    },
  });
});
```
