[Route overrides](https://docs.forestadmin.com/documentation/reference-guide/routes/override-a-route) allowed customizing the behavior of the routes exposed by the agent.

This very low-level feature was used to implement many use cases:

- Attach handlers to events in the UI
- Customize filtering, search and sort behaviors
- Other advanced use cases.

Because our new agent API is higher-level, the protocol used to communicate between the agent and the application can no longer be manipulated.

# Code cheatsheet

| What was the route override used for?   | How to migrate it?                                                                                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add custom permissions                  | Use [.addHook()](../../../../agent-customization/hooks/README.md) and throw `forbidden errors`                                                                                        |
| Add validation to fields                | Use [.addFieldValidation()](../../../../agent-customization/fields/validation.md) instead                                                                                             |
| Add validation to whole records         | Use [.addHook()](../../../../agent-customization/hooks/README.md) and throw `validation errors`                                                                                       |
| Run code on UI events                   | Use [.addHook()](../../../../agent-customization/hooks/README.md) to perform custom logic                                                                                             |
| Change the search behavior              | Use [.replaceSearch()](../../../../agent-customization/search.md) to implement your custom search logic                                                                               |
| Change the filtering behavior of fields | Use [.replaceFieldOperator()](../../../../agent-customization/fields/filter.md)                                                                                                       |
| Change the sort behavior of fields      | Use [.replaceFieldSorting()](../../../../agent-customization/fields/sort.md)                                                                                                          |
| Other use-case                          | If you are stuck or think that this guide can be improved, please [expose your use case in the community forums](https://community.forestadmin.com/) and we will be happy to help you |

# Examples

## Add custom permissions

{% hint style="warning" %}
Custom permissions would better be implemented by using the [Roles](https://docs.forestadmin.com/user-guide/project-settings/teams-and-users/manage-roles) feature from the UI.
{% endhint %}

{% tabs %} {% tab title="Before" %}

```javascript
router.delete(
  '/companies/:recordId',
  permissionMiddlewareCreator.delete(),
  (request, response, next) => {
    const { params, query, user } = request;

    if (user.email !== 'sandro.munda@forestadmin.com) {
      response.status(403).send('This collection is protected, you cannot remove it.');
      return;
    }

    next();
  },
);
```

{% endtab %} {% tab title="After" %}

```javascript
agent.customizeCollection('customers', companies => {
  // Add a hook to the "customers" collection
  companies.addHook('Before', 'Delete', async context => {
    if (context.caller.email !== 'sandro.munda@forestadmin.com')
      context.throwForbiddenError('This collection is protected, you cannot remove it.');
  });
});
```

{% endtab %} {% endtabs %}

## Add validation to fields

{% tabs %} {% tab title="Before" %}

```javascript
function handler(request, response, next) {
  const patch = request.body.data.attributes;

  if (path.name && /^Forest/.test(path.name)) {
    return "All company names should begin with 'Forest'.";
  }

  if (error) {
    response.status(400).send(error);
  } else {
    next();
  }
}

router.post('/companies', permissionMiddlewareCreator.create(), handler);
router.put('/companies/:id', permissionMiddlewareCreator.update(), handler);
```

{% endtab %} {% tab title="After" %}

```javascript
agent.customizeCollection('companies', companies => {
  companies.addFieldValidation('name', 'Match', /^Forest/);
});
```

{% endtab %} {% endtabs %}

## Run code on UI events

{% tabs %} {% tab title="Before" %}

```javascript
// Override the POST /customers route
router.post('/customers', permissionMiddlewareCreator.create(), async (req, res, next) => {
  try {
    // Call an external API.
    await superagent.post('https://my-company/create-card').set('X-API-Key', '**********').end();

    // Calls next() to executes Forest Admin's default behavior
    next();
  } catch (err) {
    next(err);
  }
});
```

{% endtab %} {% tab title="After" %}

```javascript
agent.customizeCollection('customers', companies => {
  // Add a hook to the "customers" collection
  companies.addHook('Before', 'Create', async context => {
    await superagent.post('https://my-company/create-card').set('X-API-Key', '**********').end();
  });
});
```

{% endtab %} {% endtabs %}
