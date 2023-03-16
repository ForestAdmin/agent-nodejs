# Structure

In legacy agents declaring a smart action was a two-step process:

- First, you had to declare by changing the parameters of the `collection` function in the appropriate `collections/*.js` file.
- Then, you had to implement the action by creating a route handler in the appropriate `routes/*.js` file.

In the new agent, the process is simplified to a single step.

## Steps

### Step 1: Calling `addAction` for the appropriate collection

Start by calling the `addAction` function on the appropriate collection and passing the appropriate parameters.

Most notably, you will need to pass:

- `type` should become `scope`
  - Note that the values are now capitalized (e.g. `single` becomes `Single`)
  - Legacy agents defaulted to `'bulk'` if no type was specified. The new agent requires you to specify the scope.
- `download` should become `generateFile`. This is still a boolean and the same value can be passed.
- `endpoint` and `httpMethod` should be removed. The agent will now automatically handle the routing.

{% tabs %} {% tab title="Before" %}

```javascript
collection('companies', {
  actions: [
    {
      name: 'Mark as Live',
      type: 'bulk',
      download: false,
      endpoint: '/forest/actions/mark-as-live',
    },
  ],
});
```

{% endtab %} {% tab title="After" %}

```javascript
agent.customizeCollection('companies', companies => {
  companies.addAction('Mark as Live', {
    scope: 'Bulk',
    execute: async (context, resultBuilder) => {},
  });
});
```

{% endtab %} {% endtabs %}

### Step 2: Porting the form definition

Forms are now defined in the `form` property of the action.

You can simply copy the fields definition from the legacy agent to the new agent with the following differences:

- `fields` should become `form`.
- `widget` choice is no longer supported. A default widget will be used depending on the field type.
- `hook` can be removed, those will be handled by the new agent automatically.
- `reference` no longer exists. Use `{ type: 'Collection', collectionName: '...' }` instead.
- `enums` no longer exist. Use `{ type: 'Enum', enumValues: ['...'] }` instead.

{% tabs %} {% tab title="Before" %}

```javascript
collection('customers', {
  actions: [
    {
      name: 'Charge credit card',
      type: 'single',
      fields: [
        {
          field: 'amount',
          isRequired: true,
          description: 'The amount (USD) to charge the credit card. Example: 42.50',
          type: 'Number',
        },
      ],
    },
  ],
});
```

{% endtab %} {% tab title="After" %}

```javascript
agent.customizeCollection('customers', companies => {
  companies.addAction('Charge credit card', {
    // [...]
    form: [
      {
        field: 'amount',
        isRequired: true,
        description: 'The amount (USD) to charge the credit card. Example: 42.50',
        type: 'Number',
      },
    ],
  });
});
```

{% endtab %} {% endtabs %}

### Step 3: Porting the route to the new agent `execute` function

In the legacy agent, users had to implement the action by creating a route handler in the appropriate `routes/*.js` file.

This is no longer needed as the new agent provides a `context` object that contains all the information that is needed to implement the action.

When porting the route handler to the new agent, you will need to:

- Move the body of the route handler to the `execute` function of the action.
- Replace `RecordsGetter.getIdsFromRequest()` call with `context.getRecordIds()`.
- Replace `res.send(...)` calls with `return resultBuilder.success()` or `return resultBuilder.error()`, or the [appropriate `resultBuilder` method](../../../agent-customization/actions/result-builder.md).

{% tabs %} {% tab title="Before" %}

```javascript
router.post('/actions/mark-as-live', permissionMiddlewareCreator.smartAction(), (req, res) => {
  const recordsGetter = new RecordsGetter(companies, request.user, request.query);

  return recordsGetter
    .getIdsFromRequest(req)
    .then(companyIds => companies.update({ status: 'live' }, { where: { id: companyIds } }))
    .then(() => res.send({ success: 'Company is now live!' }));
});
```

{% endtab %} {% tab title="After" %}

```javascript
agent.customizeCollection('companies', companies => {
  companies.addAction('Mark as Live', {
    // ...
    execute: async (context, resultBuilder) => {
      const companyIds = await context.getRecordIds();
      await companies.update({ status: 'live' }, { where: { id: companyIds } });

      return resultBuilder.success('Company is now live!');
    },
  });
});
```

or using the newly introduced [query interface](../../../under-the-hood/queries/README.md)

```javascript
agent.customizeCollection('companies', companies => {
  companies.addAction('Mark as Live', {
    // ...
    execute: async (context, resultBuilder) => {
      await context.collection.update(context.filter, { status: 'live' });

      return resultBuilder.success('Company is now live!');
    },
  });
});
```

{% endtab %} {% endtabs %}

### Step 4: Porting smart action hooks

Load hooks and change hooks have been replaced on the new agent by the possibility to use callbacks in the form definition.

Here is an example of a load hook where the default value of a field is set to 50 euros converted into dollars:

{% tabs %} {% tab title="Before" %}

```javascript
collection('customers', {
  actions: [
    {
      name: 'Charge credit card',
      type: 'single',
      fields: [{ field: 'amount', type: 'Number' }],

      // Here is the load hook that sets the default value of the amount field to
      // 50 euros converted into dollars
      hooks: {
        load: async ({ fields, request }) => {
          const amountField = fields.find(field => field.field === 'amount');
          amountField.value = await convertEurosIntoDollars(50);
          return fields;
        },
      },
    },
  ],
});
```

{% endtab %} {% tab title="After" %}

```javascript
agent.customizeCollection('customers', companies => {
  companies.addAction('Charge credit card', {
    scope: 'Single',
    form: [
      {
        field: 'amount',
        type: 'Number',

        // Set the default value of the amount field to 50 euros converted into dollars
        // convertEurosIntoDollars is a function that returns a promise, it will be awaited automatically
        defaultValues: () => convertEurosIntoDollars(50),
      },
    ],
  });
});
```

{% endtab %} {% endtabs %}

And another for a change hook which makes a field required if the value of another field is greater than 100:

{% tabs %} {% tab title="Before" %}

```javascript
collection('customers', {
  actions: [
    {
      name: 'Charge credit card',
      type: 'single',
      fields: [
        { field: 'amount', type: 'Number', hook: 'onAmountChange' },
        { field: 'motivation', type: 'String', isRequired: false },
      ],

      // Change hook that makes the motivation field required if the amount is greater than 100
      hooks: {
        change: {
          onAmountChange: async ({ fields, request }) => {
            const amountField = fields.find(field => field.field === 'amount');
            const motivationField = fields.find(field => field.field === 'motivation');

            motivationField.isRequired = amountField.values > 100;

            return fields;
          },
        },
      },
    },
  ],
});
```

{% endtab %} {% tab title="After" %}

```javascript
agent.customizeCollection('customers', companies => {
  companies.addAction('Charge credit card', {
    scope: 'Single',
    form: [
      { field: 'amount', type: 'Number' },
      {
        field: 'motivation',
        type: 'String',
        isRequired: context => context.formValues.amount > 100,
      },
    ],
  });
});
```

{% endtab %} {% endtabs %}
