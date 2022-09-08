Most datasources are able to import validation rules from their target.

For instance, if you are using the [SQL Datasource](../../datasources/provided/databases/sql.md)

- Columns of type `VARCHAR(15)` will automatically carry a `less than 15 chars` validator.
- Non-nullable columns will automatically carry a `Present` validator.

However, you may want to enforce stricter restrictions than the ones which are implemented in your datasource.

Note that if you need to implement custom validator, or validation over multiple fields at the same time, you may use [change hooks](../hooks/README.md).

## Example

![A field failing validation](../../assets/field-validation-error.png)

The list of operators (`Present`, `LongerThan`, ...) which can be used when adding validators is the same than the [filter operators](../../under-the-hood/queries/filters.md#operators).

```javascript
collection
  .addValidation('firstName', 'Present')
  .addValidation('firstName', 'LongerThan', 2)
  .addValidation('firstName', 'ShorterThan', 13);
```
