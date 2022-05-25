Most datasources are able to import validation rules from their target.

For instance, if you are using the [SQL Datasource](../../datasources/provided/databases/sql.md)

- Columns of type `VARCHAR(15)` will automatically carry a `less than 15 chars` validator.
- Non-nullable columns will automatically carry a `Present` validator.

However, you may want to enforce stricter restrictions than the ones which are implemented in your datasource.

## Example

The list of operators (`Present`, `LongerThan`, ...) which can be used when adding validators is the same than the [filter operators](../../under-the-hood/queries/filters.md#operators).

```javascript
collection
  .addValidation('firstName', 'Present')
  .addValidation('firstName', 'LongerThan', 2)
  .addValidation('firstName', 'ShorterThan', 15);
```
