Creating a custom data source always starts with declaring the structure of the data

- Which collections are present?
- What fields to they contain?
- What are their types?

# Columns

## Examples

```javascript
const { BaseCollection } = require('@forestadmin/datasource-toolkit');

class MovieCollection extends BaseCollection {
  constructor() {
    // [...]

    this.addField('id', {
      type: 'Column',
      columnType: 'Number',
      isPrimaryKey: true,
    });

    this.addField('title', {
      type: 'Column',
      columnType: 'String',
      validation: [{ operator: 'Present' }],
    });

    this.addField('mpa_rating', {
      type: 'Column',
      columnType: 'Enum',
      enumValues: ['G', 'PG', 'PG-13', 'R', 'NC-17'],
      defaultValue: 'G',
    });

    this.addField('stars', {
      type: 'Column',
      columnType: [{ firstName: 'String', lastName: 'String' }],
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
    { "operator": "present" },
    { "operator": "like", "value": "found%" },
    { "operator": "today" }
  ]
}
```

# Relationships

{% hint style='warning' %}
Only **intra**-datasource relationships should be declared at the collection level.

For **inter**-datasource relationships, you should use [jointures at the customization step](../../agent-customization/relationships.md)
{% endhint %}

You can declare relationships at the collection level, but that means that the datasource you are making is responsible from handling them.

This will work out of the box for datasources using the "local-cache" strategy, however please read ["Using query translation > Intra-datasource Relationships"](./query-translation/relationships.md), before starting for the "query translation" strategy.

## Examples

```javascript
const { BaseCollection } = require('@forestadmin/datasource-toolkit');

class MovieCollection extends BaseCollection {
  constructor() {
    // [...]

    this.addField('director', {
      type: 'ManyToOne',
      foreignCollection: 'people',
      foreignKey: 'directorId',
      foreignKeyTarget: 'id',
    });

    this.addField('actors', {
      type: 'ManyToMany',
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
