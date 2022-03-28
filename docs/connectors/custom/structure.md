Creating a custom connector always starts with declaring the structure of the data

- Which collections are present?
- What fields to they contain?
- What are their types?

This is needed when using both the "local cache" and "query translation" strategies.

# Defining fields

## Examples

```javascript
const { BaseCollection, PrimitiveTypes } = require('@forestadmin/connector-toolkit');

class MovieCollection extends BaseCollection {
  constructor() {
    // [...]

    this.addField('id', {
      columnType: PrimitiveType.Number,
      isPrimaryKey: true,
    });

    this.addField('title', {
      columnType: PrimitiveType.String,
      validation: [{ operator: 'present' }],
    });

    this.addField('mpa_rating', {
      columnType: PrimitiveType.Enum,
      enumValues: ['G', 'PG', 'PG-13', 'R', 'NC-17'],
      defaultValue: 'G',
    });

    this.addField('stars', {
      columnType: [{ firstName: PrimitiveType.String, lastName: PrimitiveType.String }],
    });
  }
}
```

## Field types

Fields on forest admin can either use `Primitive Types` or `Composite Types`.

The primitive types which are supported by Forest Admin are the following:

| Forest Admin Type      | Javascript Type                                           |
| ---------------------- | --------------------------------------------------------- |
| PrimitiveType.Boolean  | Boolean                                                   |
| PrimitiveType.Date     | String with format "1985-10-26T01:22:00-08:00" (ISO-8601) |
| PrimitiveType.Dateonly | String with format "1985-10-26"                           |
| PrimitiveType.Enum     | String                                                    |
| PrimitiveType.Number   | Number                                                    |
| PrimitiveType.Point    | Array of two numbers                                      |
| PrimitiveType.String   | String                                                    |
| PrimitiveType.Timeonly | String with format "01:22:00"                             |
| PrimitiveType.Uuid     | String with uuid v4 format                                |

### Composite types

{% hint style="info" %}

- Fields using composite types are not sortable and do not implement validation
- Only fields which are an array of a primitive type are filterable (depending on connector)

{% endhint %}

```javascript
// Object containing two strings
{ firstName: PrimitiveType.String, lastName: PrimitiveType.String }

// Array of strings
[PrimitiveType.String]

// Array of objects
[{ content: PrimitiveType.String }]

// Object containing an array of array of numbers
{ content: [[PrimitiveType.Number]] }
```

When using composite types, the data in the UI may not be displayed as you expect!

| Composite Type                        | Example                                       | How it gets displayed                    |
| ------------------------------------- | --------------------------------------------- | ---------------------------------------- |
| array of primitive type               | [ 'array', 'of', 'strings']                   | As a custom widget in the edition form   |
| object                                | { title: "the godfather"}                     | As a nested form in the edition form     |
| array of object                       | [{ title: "the shawshank redemption"}]        | As a new collection in related data page |
| array of object (with nested objects) | [{ rating: { kind: 'MPA", value: "PG-13" } }] | JSON editor in the edition form          |
| anything else                         |                                               | JSON editor in the edition form          |

If you want to force displaying your data as a new collection in the related data page, but can't because your data model contains nested objects, you may consider type all nested objects as `PrimitiveType.JSON`.

## Validation

When using primitive type fields, Forest Admin supports declaring a validation clause, which will be imported into the UI of the admin panel to validate records before creating / updating them.

The API for validation is the same than with [condition trees](../custom/query-translation/filters.md#condition-trees), besides the fact than their is no `"field"` entry.

```json
{
  "aggregator": "and",
  "conditions": [
    { "operator": "present" }
    { "operator": "like", "value": "found%" },
    { "not": { "operator": "today" } },
  ]
}
```
