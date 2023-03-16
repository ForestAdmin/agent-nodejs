# Structure

In legacy agents declaring a smart action was a two-step process:

- First, you had to declare by changing the parameters of the `collection` function in the appropriate `collections/*.js` file.
- Then, you had to implement the action by creating a route handler in the appropriate `routes/*.js` file.

In the new agent, the process is simplified to a single step.

## Code cheatsheet

| Legacy agent                                           | New agent                                                                 |
| ------------------------------------------------------ | ------------------------------------------------------------------------- |
| `type: 'single'`<br>`type: 'bulk'`<br>`type: 'global'` | `scope: 'Single'`<br>`scope: 'Bulk'`<br>`scope: 'Global'`                 |
| `RecordsGetter.getIdsFromRequest()`                    | `context.getRecordIds()`                                                  |
| `res.send(...)`                                        | `return resultBuilder.success()`<br>`return resultBuilder.error()`<br>... |

## Steps

### Step 1: Porting the route to the new agent `execute` function

In the legacy agent, users had to implement the action by creating a route handler in the appropriate `routes/*.js` file.

The consequence of this is that the users had to deal with the HTTP request and response objects.

Because the protocol that is used to communicate with the Forest Admin UI is non-trivial, utils were provided in the `RecordsGetter` class which enabled the data extraction from the request.

This is no longer needed as the new agent provides a `context` object that contains all the information that is needed to implement the action.

When porting the route handler to the new agent, you will need to:

- Move the body of the route handler to the `execute` function of the action.
- Replace `RecordsGetter.getIdsFromRequest()` call with `context.getRecordIds()`.
- Replace `res.send(...)` calls with `return resultBuilder.success()` or `return resultBuilder.error()`, or the [appropriate `resultBuilder` method](../../../agent-customization/actions/).

##

## Examples

### Example 1: Simple action (with no form)

{% tabs %} {% tab title="Before" %} {% code title="/forest/companies.js" %}

```javascript
const { collection } = require('forest-express-sequelize');

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

{% endcode %} {% code title="/routes/companies.js" %}

```javascript
router.post('/actions/mark-as-live', permissionMiddlewareCreator.smartAction(), (req, res) => {
  const recordsGetter = new RecordsGetter(companies, request.user, request.query);

  return recordsGetter
    .getIdsFromRequest(req)
    .then(companyIds => companies.update({ status: 'live' }, { where: { id: companyIds } }))
    .then(() => res.send({ success: 'Company is now live!' }));
});
```

{% endcode %} {% endtab %} {% tab title="After" %}

```javascript
agent.customizeCollection('companies', companies => {
  companies.addAction('Mark as Live', {
    scope: 'Bulk',
    execute: async (context, resultBuilder) => {
      const companyIds = await context.getRecordIds();
      companies.update({ status: 'live' }, { where: { id: companyIds } });

      return resultBuilder.success('Company is now live!');
    },
  });
});
```

{% endtab %} {% endtabs %}

### Example 2: Action with form

{% tabs %} {% tab title="Before" %} {% code title="/forest/companies.js" %}

```javascript
const { collection } = require('forest-express-sequelize');

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

{% endcode %} {% code title="/routes/companies.js" %}

```javascript
router.post('/actions/mark-as-live', permissionMiddlewareCreator.smartAction(), (req, res) => {
  const recordsGetter = new RecordsGetter(companies, request.user, request.query);

  return recordsGetter
    .getIdsFromRequest(req)
    .then(companyIds => companies.update({ status: 'live' }, { where: { id: companyIds } }))
    .then(() => res.send({ success: 'Companies are now live!' }));
});
```

{% endcode %} {% endtab %} {% tab title="After" %}

```javascript
agent.customizeCollection('companies', companies => {
  companies.addAction('Mark as Live', {
    scope: 'Bulk',
    execute: async (context, resultBuilder) => {
      await context.collection.update(context.filter, { status: 'live' });
      return resultBuilder.success('Companies are now live!');
    },
  });
});
```

{% endtab %} {% endtabs %}
