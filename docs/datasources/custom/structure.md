Creating a custom data source always starts with declaring the structure of the data

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

    this.addColumn('id', {
      columnType: PrimitiveType.Number,
      isPrimaryKey: true,
    });

    this.addColumn('title', {
      columnType: PrimitiveType.String,
      validation: [{ operator: 'present' }],
    });

    this.addColumn('mpa_rating', {
      columnType: PrimitiveType.Enum,
      enumValues: ['G', 'PG', 'PG-13', 'R', 'NC-17'],
      defaultValue: 'G',
    });

    this.addColumn('stars', {
      columnType: [{ firstName: PrimitiveType.String, lastName: PrimitiveType.String }],
    });
  }
}
```

## Typing

The typing system for columns is the same than the one used when declaring fields in the agent customization step.

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

{% hint style='warning' %}
Only **intra**-datasource relationships should be declared at the collection level.

For **inter**-datasource relationships, you should use [jointures at the customization step](../relationships.md)
{% endhint %}

You can declare relationships at the collection level, but that means that the datasource you are making is responsible from handling them.

This has no consequence for datasources using the "local-cache" strategy and will work out of the box, however please read ["Using query translation > Intra-datasource Relationships"](./query-translation/relationships.md), before getting started if declaring relations on a translating datasource.

## Examples

```javascript
const { BaseCollection, PrimitiveTypes } = require('@forestadmin/datasource-toolkit');

class MovieCollection extends BaseCollection {
  constructor() {
    // [...]

    this.addRelation('director', {
      type: FieldType.ManyToOne,
      foreignCollection: 'people',
      foreignKey: 'directorId',
      foreignKeyTarget: 'id',
    });

    this.addRelation('actors', {
      type: FieldType.ManyToMany,
      foreignCollection: 'people',
      throughCollection: 'actorsOnMovies',
      originKey: 'movieId',
      originKeyTarget: 'id',
      foreignKey: 'actorId',
      foreignKeyTarget: 'id',
    });
  }
}
```

## Typing

The typing system for relationships is the same than the one used when declaring jointures in the agent customization step.

You can read all about it in ["Under the hood > Data Model > Relationships"](../../under-the-hood/data-model/relationships.md).
