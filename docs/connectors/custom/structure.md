Creating a custom connector always starts with declaring the structure of the data

- Which collections are present?
- What fields to they contain?
- What are their types?

This is needed when using both the "local cache" and "query translation" strategies.

# Columns

## Examples

```javascript
const { BaseCollection, PrimitiveTypes } = require('@forestadmin/datasource-toolkit');

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

## Typing

The typing system when writing a connector is the same than the one used when declaring fields in the agent customization step.

You can read all about it in ["Under the hood > Data Model > Typing"](../../under-the-hood/data-model/typing.md).

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

# Relationships

// FIXME
