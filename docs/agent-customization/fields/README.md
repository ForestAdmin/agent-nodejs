Forest Admin is an admin-panel, not a WYSIWYG on top of your database.

When designing databases and APIs, the way to go is usually to push for _normalization_. This means ensuring there is no redundancy of data (all data is stored in only one place), and that data dependencies are logical.

On the other hand graphical user interfaces usually need duplication and shortcuts to be user-friendly.

In order to bridge that gap, Forest Admin allows to add, move, remove and override behavior from fields on all collections.

# Minimal example

```javascript
collection
  // Create a new field
  .addField('fullName', {
    type: 'String',
    dependencies: ['firstName', 'lastName'],
    getValues: (records, context) => records.map(r => `${r.firstName} ${r.lastName}`),
  })

  // Make it filterable and sortable
  .emulateFieldFiltering('fullName')
  .emulateFieldSorting('fullName')

  // Remove previous fields
  .removeField('firstName', 'lastName');
```
