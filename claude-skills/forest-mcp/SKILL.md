---
name: forest-mcp
description: Query and manipulate Forest Admin data through MCP tools. Use when the user wants to search, filter, explore, create, update, or delete data from their Forest Admin database. Triggers on questions like "find all users", "create a new order", "update user 42", "delete inactive products", or any data operation request.
---

# Forest Admin MCP

Query and manipulate Forest Admin data as if it were a database, with an abstraction layer that handles authentication, filtering, and relationships.

## Available Tools

| Tool | Purpose |
|------|---------|
| `describeCollection` | Get collection schema (fields, types, operators, relations) |
| `list` | Query records from a collection |
| `listRelated` | Query records from a one-to-many or many-to-many relation |
| `create` | Create a new record in a collection |
| `update` | Update an existing record by ID |
| `delete` | Delete one or more records by IDs |

## Workflow

1. **Always start with `describeCollection`** to understand the collection structure before querying or modifying data
2. Use `list` for direct collection queries
3. Use `listRelated` to traverse relationships (e.g., "orders of user 123")
4. Use `create`, `update`, `delete` for data modifications

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

**"Create a new user"**
```
create({
  collectionName: "users",
  attributes: {
    name: "John Doe",
    email: "john@example.com",
    status: "active"
  }
})
```

**"Update user 42's email"**
```
update({
  collectionName: "users",
  recordId: 42,
  attributes: {
    email: "newemail@example.com"
  }
})
```

**"Delete inactive users"**
```
1. list({ collectionName: "users", filters: { field: "status", operator: "Equal", value: "inactive" } })
2. delete({
     collectionName: "users",
     recordIds: [1, 5, 12]  // IDs from the list result
   })
```

## Tips

- Use `enableCount: true` when user asks "how many" or needs totals
- Use `fields: ["id", "name"]` to reduce payload when only specific fields needed
- Use `search` parameter for full-text search across searchable fields
- Check `isSortable` from describeCollection before using sort
- For `update`, only include attributes you want to change
- For `delete`, always confirm with user before deleting multiple records
