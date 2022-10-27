This plugin allows you to import fields from a given [one to one](../../../agent-customization/relationships/single-record.md#one-to-one-relations) or [many to one](../../../agent-customization/relationships/single-record.md#many-to-one-relations) relations.
It is useful when you want to repatriate multiple fields inside one collection.

## Installation

```bash
yarn add @forestadmin/plugin-import-fields
```

## Examples

Let's imagine we have a *customer* collection with a [one to one](../../../agent-customization/relationships/single-record.md#one-to-one-relations) address relation. 
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

To make all the imported fields in readonly mode you can use *readonly* argument:

```javascript
collection.use(importFields, { relationName: 'address', readonly: true })
```
