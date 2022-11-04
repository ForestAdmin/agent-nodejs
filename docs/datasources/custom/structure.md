Creating a custom data source always starts with declaring the structure of the data

- Which collections are present?
- What fields do they contain?
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

The typing system for columns is the same as the one used when declaring fields in the agent customization step.

You can read all about it in ["Under the hood > Data Model > Typing"](../../under-the-hood/data-model/typing.md).

## Validation

When using primitive type fields, Forest Admin supports declaring a validation clause, which will be imported into the UI of the admin panel to validate records before creating/updating them.

The API for validation is the same as with [condition trees](../../under-the-hood/queries/filters.md#condition-trees), besides the fact that there is no `"field"` entry.

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
Only **intra**-data source relationships should be declared at the collection level.

For **inter**-data source relationships, you should use [jointures at the customization step](../../agent-customization/relationships/README.md)
{% endhint %}

You can declare relationships at the collection level, but that means that the data source you are making is responsible for handling them.

This will work out of the box for data sources using the "local-cache" strategy, however, please read ["Intra-data source Relationships"](./relationships.md), before starting with the "query translation" strategy.

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

The typing system for relationships is the same as the one used when declaring jointures in the agent customization step.

You can read all about it in ["Under the hood > Data Model > Relationships"](../../under-the-hood/data-model/relationships.md).
