This plugin allows you to import fields from a given *one to one* or *many to one* relations.
It is super useful when you want to repatriate a lot of fields inside one collection.

## Installation

```bash
yarn add @forestadmin/plugin-import-fields
```

## Examples

Let's imagine we have a *customer* collection with a *one to one* address relation. 
The address collection has the following structure: *id, street, city, zipCode, country, customerId*.

If we want import all the fields inside customer collection:

```javascript
const { importFields } = require('@forestadmin/plugin-import-fields');

agent.customizeCollection('customer', collection => {
    return collection.use(importFields, { relationName: 'address' });
});
```

If we want to import only the city and the country we can use the *include* argument:

```javascript
collection.use(importFields, { relationName: 'address', include: ['city', 'country'] });
```

If we want to import all the fields except the city we can use the *exclude* argument:

```javascript
collection.use(importFields, { relationName: 'address', exclude: ['city'] })
```
