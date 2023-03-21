Your new agent is up and running, congratulations!

Because of the internal changes, you might already have noticed a performance improvement when you migrated your agent.
Let's see how you can optimize your agent even more.

# Computed fields

## Replace queries with the `dependencies` option

A common pattern in the old agent was to make queries in the `get` function of a computed field to fetch relations.

This is now natively supported with the `dependencies` option, and it is much faster.

If you ported your agent by using the simpler route, which is copying the old agent code to the new agent, you can probably replace a lot of your queries with the `dependencies` option.

{% tabs %} {% tab title="Before" %}

```javascript
agent.customizeCollection('post', postCollection => {
  postCollection.addField('authorFullName', {
    columnType: 'String',
    dependencies: ['authorId'],
    getValues: async posts =>
      Promise.all(
        posts.map(async post => {
          // Those async query take a long time and are performed in parallel with the other queries
          const author = await models.authors.findOne({ where: { id: post.authorId } });
          return `${author.firstName} ${author.lastName}`;
        }),
      ),
  });
});
```

{% endtab %} {% tab title="After" %}

```javascript
agent.customizeCollection('post', postCollection => {
  postCollection.addField('authorFullName', {
    columnType: 'String',
    // The agent will automatically fetch the author collection and join it with the post collection
    // by performing a INNER JOIN on the authorId field.
    // This is _much_ faster than performing a query for each post

    dependencies: ['author:firstName', 'author:lastName'],
    getValues: posts => posts.map(post => `${post.author.firstName} ${post.author.lastName}`),
  });
});
```

or (better)

```javascript
// Define the field on the author collection
agent.customizeCollection('author', authorCollection => {
  authorCollection.addField('fullName', {
    columnType: 'String',
    dependencies: ['firstName', 'lastName'],
    getValues: authors => authors.map(author => `${author.firstName} ${author.lastName}`),
  });
});

// And then import it on the post collection
agent.customizeCollection('post', postCollection => {
  postCollection.importField('authorFullName', { path: 'author:fullName' });
});
```

```javascript

```

{% endtab %} {% endtabs %}

## Move async calls outside of the hot loop

The new computed field syntax works in batch mode.

If you have computed fields that take a long time to compute, you may want to use this new syntax to optimize them.

{% tabs %} {% tab title="Before" %}

```javascript
agent.customizeCollection('users', users => {
  users.addField('full_address', {
    columnType: 'String',
    dependencies: ['address_id'],
    getValues: async users =>
      Promise.all(
        users.map(async user => {
          // Get the address for each user individually
          // This is very slow if you are displaying a lot of users in a table
          const address = await geoWebService.getAddress(customer.address_id);

          return [
            address.address_line_1,
            address.address_line_2,
            address.address_city,
            address.country,
          ].join('\n');
        }),
      ),
  });
});
```

{% endtab %} {% tab title="After" %}

```javascript
agent.customizeCollection('users', users => {
  users.addField('full_address', {
    columnType: 'String',
    dependencies: ['address_id'],
    getValues: async users => {
      // Get all the addresses in a single request
      // This is much faster if you are displaying a lot of users in a table
      const addresses = await geoWebService.getAddresses(users.map(user => user.address_id));

      // Return the full address for each user
      return users.map(user => {
        const address = addresses.find(address => address.id === user.address_id);

        return [
          address.address_line_1,
          address.address_line_2,
          address.address_city,
          address.country,
        ].join('\n');
      });
    },
  });
});
```

{% endtab %} {% endtabs %}

## Avoid duplicate queries

If you happen to have computed fields that are similar, or that depend on the same data, you can make fields that depend on other fields.

{% tabs %} {% tab title="Before" %}

```javascript
agent.customizeCollection('users', users => {
  users.addField('firstName', {
    columnType: 'String',
    dependencies: ['id'],
    getValues: async users => {
      const userInfo = await authenticationWebService.getUserInfo(users.map(user => user.id));
      return users.map(user => userInfo.find(userInfo => userInfo.id === user.id).firstName);
    },
  });

  users.addField('lastName', {
    columnType: 'String',
    dependencies: ['id'],
    getValues: async users => {
      const userInfo = await authenticationWebService.getUserInfo(users.map(user => user.id));
      return users.map(user => userInfo.find(userInfo => userInfo.id === user.id).lastName);
    },
  });
});
```

{% endtab %} {% tab title="After" %}

Install the [`@forestadmin/plugin-flattener`](../../../agent-customization/plugins/provided/flattener.md) plugin.

```console
npm install @forestadmin/plugin-flattener
```

Fetch all the user info in a single request, and then flatten the result.

```javascript
const { flattenColumn } = require('@forestadmin/plugin-flattener');

agent.customizeCollection('users', users => {
  users.addField('userInfo', {
    columnType: { firstName: 'String', lastName: 'String' },
    dependencies: ['id'],
    getValues: async users => {
      const userInfo = await authenticationWebService.getUserInfo(users.map(user => user.id));
      return users.map(user => userInfo.find(userInfo => userInfo.id === user.id));
    },
  });

  users.use(flattenColumn, { columnName: 'userInfo' });
});
```

{% endtab %} {% endtabs %}

# Search

The new agent introduced the capability to customize the search behavior of your agent depending on the search query.

This is a very powerful feature that allows you to make sure that your agent is fast.

Documentation about this feature is available [here](../../../agent-customization/search.md#changing-searched-columns).
