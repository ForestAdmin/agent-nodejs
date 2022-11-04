This plugin allows you to import fields from a given [one-to-one](../../../agent-customization/relationships/single-record.md#one-to-one-relations) or [many-to-one](../../../agent-customization/relationships/single-record.md#many-to-one-relations) relations.
It is useful when you want to repatriate multiple fields inside one collection.

## Installation

```bash
yarn add @forestadmin/plugin-import-fields
```

## Examples

Let's imagine we have a _customer_ collection with a [one-to-one](../../../agent-customization/relationships/single-record.md#one-to-one-relations) address relation.
The address collection has the following structure: _id, street, city, zipCode, country, customerId_.

If we want to import all the fields inside fo the `customer` collection:

```javascript
const { importFields } = require('@forestadmin/plugin-import-fields');

agent.customizeCollection('customer', collection => {
  return collection.use(importFields, { relationName: 'address' });
});
```

If we want to import only the city and the country we can use the _include_ argument:

```javascript
collection.use(importFields, { relationName: 'address', include: ['city', 'country'] });
```

If we want to import all the fields except the city we can use the _exclude_ argument:

```javascript
collection.use(importFields, { relationName: 'address', exclude: ['city'] });
```

To make all the imported fields read-only you can use the _readonly_ argument:

```javascript
collection.use(importFields, { relationName: 'address', readonly: true });
```
