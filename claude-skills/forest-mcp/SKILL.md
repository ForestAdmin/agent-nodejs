---
name: forest-mcp
description: Query Forest Admin data through MCP tools. Use when the user wants to search, filter, or explore data from their Forest Admin database. Triggers on questions like "find all users", "show orders from last week", "how many products", or any data exploration request.
---

# Forest Admin MCP

Query Forest Admin data as if it were a database, with an abstraction layer that handles authentication, filtering, and relationships.

## Available Tools

| Tool | Purpose |
|------|---------|
| `describeCollection` | Get collection schema (fields, types, operators, relations) |
| `list` | Query records from a collection |
| `listRelated` | Query records from a one-to-many or many-to-many relation |

## Workflow

1. **Always start with `describeCollection`** to understand the collection structure before querying
2. Use `list` for direct collection queries
3. Use `listRelated` to traverse relationships (e.g., "orders of user 123")

## Filter Syntax

```json
// Simple condition
{ "field": "status", "operator": "Equal", "value": "active" }

// Combined conditions
{
  "aggregator": "And",
  "conditions": [
    { "field": "status", "operator": "Equal", "value": "active" },
    { "field": "age", "operator": "GreaterThan", "value": 18 }
  ]
}
```

### Common Operators

| Category | Operators |
|----------|-----------|
| Comparison | `Equal`, `NotEqual`, `LessThan`, `GreaterThan`, `LessThanOrEqual`, `GreaterThanOrEqual` |
| String | `Contains`, `StartsWith`, `EndsWith`, `IContains` (case-insensitive) |
| Array | `In`, `NotIn`, `IncludesAll` |
| Null | `Present`, `Blank`, `Missing` |
| Date | `Today`, `Yesterday`, `Before`, `After`, `PreviousWeek`, `PreviousMonth` |

### Nested Fields

Use `@@@` separator for relation fields:
```json
{ "field": "customer@@@email", "operator": "Contains", "value": "@gmail.com" }
```

## Examples

**"Find active users created this month"**
```
1. describeCollection({ collectionName: "users" })
2. list({
     collectionName: "users",
     filters: {
       aggregator: "And",
       conditions: [
         { field: "status", operator: "Equal", value: "active" },
         { field: "createdAt", operator: "PreviousMonth" }
       ]
     }
   })
```

**"Show orders for user 42"**
```
1. describeCollection({ collectionName: "users" }) // to find relation name
2. listRelated({
     collectionName: "users",
     relationName: "orders",
     parentRecordId: 42
   })
```

**"Count pending orders over $100"**
```
list({
  collectionName: "orders",
  filters: {
    aggregator: "And",
    conditions: [
      { field: "status", operator: "Equal", value: "pending" },
      { field: "total", operator: "GreaterThan", value: 100 }
    ]
  },
  enableCount: true
})
```

## Tips

- Use `enableCount: true` when user asks "how many" or needs totals
- Use `fields: ["id", "name"]` to reduce payload when only specific fields needed
- Use `search` parameter for full-text search across searchable fields
- Check `isSortable` from describeCollection before using sort
