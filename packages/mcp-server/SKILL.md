---
name: forest-mcp
description: Query and manipulate Forest Admin data and execute actions through MCP tools. Use when the user wants to search, filter, explore, create, update, delete data from their Forest Admin database, or execute custom actions. Triggers on questions like "find all users", "create a new order", "update user 42", "delete inactive products", "execute action Y on record Z", or any data operation request.
---

# Forest Admin MCP

Query and manipulate Forest Admin data and execute custom actions as if it were a database, with an abstraction layer that handles authentication, filtering, and relationships.

## Available Tools

| Tool | Purpose |
|------|---------|
| `describeCollection` | Get collection schema (fields, types, operators, relations, **actions**) |
| `list` | Query records from a collection |
| `listRelated` | Query records from a one-to-many or many-to-many relation |
| `create` | Create a new record in a collection |
| `update` | Update an existing record by ID |
| `delete` | Delete one or more records by IDs |
| `getActionForm` | Load action form fields (supports dynamic forms and multi-page) |
| `executeAction` | Execute a custom action with form values |

## Workflow

### Querying Data
1. **Always start with `describeCollection`** to understand the collection structure before querying
2. Use `list` for direct collection queries
3. Use `listRelated` to traverse relationships (e.g., "orders of user 123")

### Modifying Data
1. Use `create` to add new records
2. Use `update` to modify existing records
3. Use `delete` to remove records (confirm with user first for bulk deletes)

### Executing Actions
1. Use `describeCollection` to see available actions on a collection
2. Use `getActionForm` to load form fields
3. Use `executeAction` to run the action with values

### Dynamic Forms & Multi-Page Actions

Some actions have **dynamic forms** where field values affect other fields (reveal/hide fields), or **multi-page forms** that span multiple pages.

**Key concept:** Forms can be dynamic. Fill fields from top to bottom and call `getActionForm` again with updated values to see if new fields appeared.

**Simple action (no dynamics):**
```
getActionForm() → executeAction({ values })
```

**Dynamic form (fields depend on other fields):**
```
getActionForm() → see initial fields, fill them top to bottom
getActionForm({ values: { "Type": "Pro" } }) → new fields may appear based on Type
getActionForm({ values: { "Type": "Pro", "SIRET": "123" } }) → continue filling
executeAction({ values: { "Type": "Pro", "SIRET": "123", ... } })
```

**Multi-page dynamic form:**
```
getActionForm() → see page 1 fields + layout.pages
getActionForm({ values: page1Values }) → see page 2 fields
getActionForm({ values: { ...page1, ...page2 } }) → see page 3 fields
executeAction({ values: allValues })
```

The response includes `hints`:
- `canExecute`: Are all required fields filled?
- `requiredFieldsMissing`: List of required fields without values

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

**"Execute simple action"**
```
1. getActionForm({
     collectionName: "users",
     actionName: "Send Reminder",
     recordIds: [42]
   })
2. executeAction({
     collectionName: "users",
     actionName: "Send Reminder",
     recordIds: [42],
     values: { "Message": "Please update your profile" }
   })
```

**"Execute dynamic form action"**
```
// Step 1: Load initial form
1. getActionForm({
     collectionName: "customers",
     actionName: "Create Contract",
     recordIds: [42]
   })
   // Response: fields: [{ name: "Client Type", enums: ["Pro", "Individual"] }]
   //           layout: { type: "multi-page", pages: [...] }

// Step 2: Set value to discover dependent fields
2. getActionForm({
     collectionName: "customers",
     actionName: "Create Contract",
     recordIds: [42],
     values: { "Client Type": "Pro" }
   })
   // Response: fields now include SIRET, Company Name, etc.

// Step 3: Execute with all values
3. executeAction({
     collectionName: "customers",
     actionName: "Create Contract",
     recordIds: [42],
     values: {
       "Client Type": "Pro",
       "SIRET": "12345678901234",
       "Company Name": "Acme Corp"
     }
   })
```

**"Run bulk action on multiple records"**
```
executeAction({
  collectionName: "orders",
  actionName: "Mark as Shipped",
  recordIds: [101, 102, 103],
  values: { "Tracking Number": "ABC123" }
})
```

**"Run global action (no records needed)"**
```
executeAction({
  collectionName: "reports",
  actionName: "Generate Monthly Report",
  values: { "Month": "December", "Year": 2024 }
})
```

## Action Types

| Type | Description | recordIds |
|------|-------------|-----------|
| `single` | Operates on exactly one record | Required (1 ID) |
| `bulk` | Operates on one or more records | Required (1+ IDs) |
| `global` | Collection-level action, no records | Optional/Not needed |

## getActionForm Response

```json
{
  "fields": [
    {
      "name": "Field Name",
      "type": "String|Number|Boolean|Date|Enum|File|Json|StringList|NumberList",
      "value": "current value or null",
      "isRequired": true,
      "isReadOnly": false,
      "description": "Field description",
      "enums": ["option1", "option2"],
      "options": [{ "label": "...", "value": "..." }],
      "reference": "collectionName.fieldName",
      "widget": {
        "type": "dropdown|text editor|number input|date editor|file picker|...",
        "placeholder": "Enter value...",
        "min": 0,
        "max": 100,
        "step": 1,
        "rows": 5,
        "format": "YYYY-MM-DD",
        "minDate": "2024-01-01",
        "maxDate": "2024-12-31",
        "currency": "EUR",
        "currencyBase": "Unit|Cents",
        "allowedExtensions": [".pdf", ".doc"],
        "maxSizeMb": 10,
        "maxFiles": 5,
        "enableReorder": true,
        "allowDuplicates": false,
        "isSearchable": true,
        "hasDynamicSearch": true
      }
    }
  ],
  "layout": {
    "type": "single-page|multi-page",
    "pages": [
      {
        "pageNumber": 1,
        "elements": [...],
        "nextButtonLabel": "Next"
      },
      {
        "pageNumber": 2,
        "elements": [...],
        "previousButtonLabel": "Back",
        "nextButtonLabel": "Submit"
      }
    ]
  },
  "hints": {
    "canExecute": true,
    "requiredFieldsMissing": ["Field1", "Field2"]
  }
}
```

## executeAction Response

```json
// Success result
{
  "type": "Success",
  "message": "Action completed successfully",
  "html": "<p>Optional HTML content</p>",
  "invalidatedRelations": ["orders", "payments"]
}

// Webhook result (action triggers external call)
{
  "type": "Webhook",
  "webhook": {
    "url": "https://api.example.com/webhook",
    "method": "POST",
    "headers": { "Authorization": "Bearer token" },
    "body": { "data": "..." }
  }
}

// Redirect result (action wants to navigate)
{
  "type": "Redirect",
  "redirectTo": "/users/42"
}

// File download result (for files < 5MB)
{
  "type": "File",
  "fileName": "report.csv",
  "mimeType": "text/csv",
  "contentBase64": "bmFtZSxlbWFpbA0KSm9obixqb2huQGV4YW1wbGUuY29t",
  "sizeBytes": 1234
}

// File too large (> 5MB)
{
  "type": "FileTooLarge",
  "fileName": "large-export.zip",
  "mimeType": "application/zip",
  "sizeBytes": 10485760,
  "maxSizeBytes": 5242880
}
```

## File Upload

To upload a file in an action form, pass a file object with base64 content:

```json
executeAction({
  collectionName: "documents",
  actionName: "Import Config",
  values: {
    "Config File": {
      "name": "config.json",
      "mimeType": "application/json",
      "contentBase64": "eyJzZXR0aW5ncyI6IHt9fQ=="
    }
  }
})
```

For multiple files (FileList fields):
```json
{
  "Documents": [
    { "name": "doc1.pdf", "mimeType": "application/pdf", "contentBase64": "..." },
    { "name": "doc2.pdf", "mimeType": "application/pdf", "contentBase64": "..." }
  ]
}
```

## Tips

- Use `enableCount: true` when user asks "how many" or needs totals
- Use `fields: ["id", "name"]` to reduce payload when only specific fields needed
- Use `search` parameter for full-text search across searchable fields
- Check `isSortable` from describeCollection before using sort
- For `update`, only include attributes you want to change
- For `delete`, always confirm with user before deleting multiple records
- Forms can be dynamic: fill fields top to bottom, call `getActionForm` again after changes to see new fields
- Check `hints.canExecute` to know if all required fields are filled
- Check `layout.type` to know if form has multiple pages
- Action `type` in describeCollection tells you if recordIds are needed
- Use `widget` metadata for validation hints (min/max, allowed extensions, etc.)

## Known Limitations

| Feature | Status | Notes |
|---------|--------|-------|
| File uploads | Supported | Pass `{ name, mimeType, contentBase64 }` as field value |
| File downloads | Supported (< 5MB) | Returns base64 content for small files |
| Large file downloads | Limited | Files > 5MB return `FileTooLarge` error |
| Collection field search | Limited | Reference fields exist but dynamic search not exposed |
| Approval workflows | Not exposed | Actions requiring approval not fully supported |
