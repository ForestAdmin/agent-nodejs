# Customization Fields

## Rename

When you want to rename a field in the collection.

```typescript
    dvdCollection.renameField('priceInDollar','price');
```

It will rename the field `priceInDollar` to `price`.

## Unpublish

When you want to unpublish the visibility of certain fields.

```typescript
    dvdCollection.removeField('price', 'name');
```

The fields `price` and `name` will not be visible by the frontend.

## Register

When you want to register a new field computed from others fields.

{% hint style='warning' %}
    Be careful the operation will do in memory it means that all records will be loaded in memory.
{% endhint %}

For example, when you want to compute the new field value from the `name` and the `price` values.

```typescript
    const { PrimitiveTypes } = require('@forestadmin/datasource-toolkit');

    dvdCollection.addField('nameAndPrice', {
        columnType: PrimitiveTypes.String,
        dependencies: ['name', 'price'],
        getValues: (records) => records.map(record => `${record.name} - ${record.price}`)
    });
```

The `nameAndPrice` is a new field and usable like other fields.

## Sort

Enable sorting on a specific field.

### Emulate

When you want to make a field sortable easily.

{% hint style='warning' %}
    Be careful the operation will do in memory it means that all records will be loaded in memory.
{% endhint %}


```typescript
    dvdCollection.emulateFieldSorting('nameAndPrice');
```

### Implement

When you want to provide your definition to make a field sortable.

{% hint style='warning' %}
    Be careful the operation will do in memory it means that all records will be loaded in memory.
{% endhint %}

```typescript
    dvdCollection.replaceFieldSorting('nameAndPrice', [
         { field: 'name', ascending: true },
         { field: 'price',  ascending: true }
    ]);
```

### Advanced

When you want to define a specific sort.

For example, when you want to sort the field value that looks like `dvd-title.extension-name`
and you want to sort by the `extension-name`.

You should [register a field](#register-a-field) to get a field with only the `extension-name`.

```typescript
    const { PrimitiveTypes } = require('@forestadmin/datasource-toolkit');

    dvdCollection.addField('extensionName', {
        columnType: PrimitiveTypes.String,
        dependencies: ['dvdTitleWithExtensionName'],
        getValues: (records) => records.map(record => {
            // the-lord-of-the-rings.AVI => AVI
            const [,extensionName] = record.split('.');
            return extensionName;
        })
    });
```

Then you can sort `dvdTitleWithExtensionName` by the `extensionName` field.

```typescript
    dvdCollection.replaceFieldSorting('dvdTitleWithExtensionName', [
        { field: 'extensionName', ascending: true },
    ]);
```

If you want to hide the `extensionName` field you can [unpublish the field](#unpublish-fields).


## Operator

Enable filtering on a specific field with a specific operator.

### Emulate

When you want to provide a field operator easily.

{% hint style='warning' %}
    Be careful the operation will do in memory it means that all records will be loaded in memory.
{% endhint %}

```typescript
    const { Operator } = require('@forestadmin/datasource-toolkit');
    
    dvdCollection.emulateOperatorField('nameAndPrice', Operator.In);
```

Now `nameAndPrice` field can be filtered with the `In` operator.

### Implement

When you want to provide your definition to make a field operator available.

{% hint style='warning' %}
    Be careful the operation will do in memory it means that all records will be loaded in memory.
{% endhint %}

```typescript
    const { Operator } = require('@forestadmin/datasource-toolkit');

    dvdCollection.implementOperator('nameAndPrice', Operator.Equal, async (value: unknown) => {
        return new ConditionTreeNot(
            new ConditionTreeLeaf('nameAndPrice', Operator.Equal, value),
        );
    });
```
