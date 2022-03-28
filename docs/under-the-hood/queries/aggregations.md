An aggregation represents a query to a collection which aggregates on records.

They are simple three keys objects:

- An `operation` which specify how the data should be aggregated (`Count`, `Sum`, `Avg`, `Max`, `Min`)
- A `field`, which specify the data that should be aggregated
- `Groups`, which may be rounded when they are Dates

Supported group rounding operations are: `Year`, `Month`, `Week`, `Day` and `null` (let the field as it is).

### Count records

The simplest possible query is to count records from a collection

```json
{ "operation": "Count", "field": null, "groups": [] }
```

Equivalent in SQL : `SELECT COUNT(*) FROM books`

### Average rating

```json
{ "operation": "Average", "field": "rating", "groups": [] }
```

Equivalent in SQL : `SELECT AVG(rating) FROM books`

### Average rating by author

```json
{ "operation": "Average", "field": "rating", "groups": [{ "field": "author:name" }] }
```

Equivalent in SQL : `SELECT authorName, AVG(rating) FROM books GROUP BY 1`

### Average rating by author and year

```json
{
  "operation": "Average",
  "field": "rating",
  "groups": [{ "field": "authorName" }, { "field": "createdAt", "operation": "Year" }]
}
```

Equivalent in SQL : `SELECT authorName, TO_YEAR(createdAt), AVG(rating) FROM books GROUP BY 1, 2`
