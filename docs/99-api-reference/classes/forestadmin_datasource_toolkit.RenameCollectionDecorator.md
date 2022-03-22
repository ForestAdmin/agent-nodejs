[root](../README.md) / [Modules](../modules.md) / [@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md) / RenameCollectionDecorator

# Class: RenameCollectionDecorator

[@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md).RenameCollectionDecorator

This decorator renames fields.

It works on one side, by rewriting all references to fields in aggregations, filters, projections
and on the other, by rewriting records and aggregation results which are returned by the
subCollection.

## Hierarchy

- `default`

  ↳ **`RenameCollectionDecorator`**

## Table of contents

### Constructors

- [constructor](forestadmin_datasource_toolkit.RenameCollectionDecorator.md#constructor)

### Properties

- [childCollection](forestadmin_datasource_toolkit.RenameCollectionDecorator.md#childcollection)
- [dataSource](forestadmin_datasource_toolkit.RenameCollectionDecorator.md#datasource)

### Accessors

- [name](forestadmin_datasource_toolkit.RenameCollectionDecorator.md#name)
- [schema](forestadmin_datasource_toolkit.RenameCollectionDecorator.md#schema)

### Methods

- [aggregate](forestadmin_datasource_toolkit.RenameCollectionDecorator.md#aggregate)
- [create](forestadmin_datasource_toolkit.RenameCollectionDecorator.md#create)
- [delete](forestadmin_datasource_toolkit.RenameCollectionDecorator.md#delete)
- [execute](forestadmin_datasource_toolkit.RenameCollectionDecorator.md#execute)
- [getForm](forestadmin_datasource_toolkit.RenameCollectionDecorator.md#getform)
- [list](forestadmin_datasource_toolkit.RenameCollectionDecorator.md#list)
- [refineFilter](forestadmin_datasource_toolkit.RenameCollectionDecorator.md#refinefilter)
- [refineSchema](forestadmin_datasource_toolkit.RenameCollectionDecorator.md#refineschema)
- [renameField](forestadmin_datasource_toolkit.RenameCollectionDecorator.md#renamefield)
- [update](forestadmin_datasource_toolkit.RenameCollectionDecorator.md#update)

## Constructors

### constructor

• **new RenameCollectionDecorator**(`childCollection`, `dataSource`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `childCollection` | [`Collection`](../interfaces/forestadmin_datasource_toolkit.Collection.md) |
| `dataSource` | [`DataSource`](../interfaces/forestadmin_datasource_toolkit.DataSource.md) |

#### Inherited from

CollectionDecorator.constructor

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:14](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L14)

## Properties

### childCollection

• `Protected` **childCollection**: [`Collection`](../interfaces/forestadmin_datasource_toolkit.Collection.md)

#### Inherited from

CollectionDecorator.childCollection

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:12](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L12)

___

### dataSource

• `Readonly` **dataSource**: [`DataSourceDecorator`](forestadmin_datasource_toolkit.DataSourceDecorator.md)<[`RenameCollectionDecorator`](forestadmin_datasource_toolkit.RenameCollectionDecorator.md)\>

#### Overrides

CollectionDecorator.dataSource

#### Defined in

[packages/datasource-toolkit/src/decorators/rename/collection.ts:18](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/decorators/rename/collection.ts#L18)

## Accessors

### name

• `get` **name**(): `string`

#### Returns

`string`

#### Inherited from

CollectionDecorator.name

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:19](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L19)

___

### schema

• `get` **schema**(): [`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema)

#### Returns

[`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema)

#### Inherited from

CollectionDecorator.schema

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:23](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L23)

## Methods

### aggregate

▸ **aggregate**(`filter`, `aggregation`, `limit?`): `Promise`<[`AggregateResult`](../modules/forestadmin_datasource_toolkit.md#aggregateresult)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`Filter`](forestadmin_datasource_toolkit.Filter.md) |
| `aggregation` | [`Aggregation`](forestadmin_datasource_toolkit.Aggregation.md) |
| `limit?` | `number` |

#### Returns

`Promise`<[`AggregateResult`](../modules/forestadmin_datasource_toolkit.md#aggregateresult)[]\>

#### Overrides

CollectionDecorator.aggregate

#### Defined in

[packages/datasource-toolkit/src/decorators/rename/collection.ts:100](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/decorators/rename/collection.ts#L100)

___

### create

▸ **create**(`records`): `Promise`<[`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `records` | [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[] |

#### Returns

`Promise`<[`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[]\>

#### Overrides

CollectionDecorator.create

#### Defined in

[packages/datasource-toolkit/src/decorators/rename/collection.ts:81](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/decorators/rename/collection.ts#L81)

___

### delete

▸ **delete**(`filter`): `Promise`<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`Filter`](forestadmin_datasource_toolkit.Filter.md) |

#### Returns

`Promise`<`void`\>

#### Inherited from

CollectionDecorator.delete

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:55](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L55)

___

### execute

▸ **execute**(`name`, `data`, `filter?`): `Promise`<[`ActionResult`](../modules/forestadmin_datasource_toolkit.md#actionresult)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `data` | [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata) |
| `filter?` | [`Filter`](forestadmin_datasource_toolkit.Filter.md) |

#### Returns

`Promise`<[`ActionResult`](../modules/forestadmin_datasource_toolkit.md#actionresult)\>

#### Inherited from

CollectionDecorator.execute

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:27](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L27)

___

### getForm

▸ **getForm**(`name`, `data?`, `filter?`): `Promise`<[`ActionField`](../interfaces/forestadmin_datasource_toolkit.ActionField.md)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `data?` | [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata) |
| `filter?` | [`Filter`](forestadmin_datasource_toolkit.Filter.md) |

#### Returns

`Promise`<[`ActionField`](../interfaces/forestadmin_datasource_toolkit.ActionField.md)[]\>

#### Inherited from

CollectionDecorator.getForm

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:33](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L33)

___

### list

▸ **list**(`filter`, `projection`): `Promise`<[`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`PaginatedFilter`](forestadmin_datasource_toolkit.PaginatedFilter.md) |
| `projection` | [`Projection`](forestadmin_datasource_toolkit.Projection.md) |

#### Returns

`Promise`<[`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[]\>

#### Overrides

CollectionDecorator.list

#### Defined in

[packages/datasource-toolkit/src/decorators/rename/collection.ts:89](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/decorators/rename/collection.ts#L89)

___

### refineFilter

▸ `Protected` **refineFilter**(`filter?`): `Promise`<[`PaginatedFilter`](forestadmin_datasource_toolkit.PaginatedFilter.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter?` | [`PaginatedFilter`](forestadmin_datasource_toolkit.PaginatedFilter.md) |

#### Returns

`Promise`<[`PaginatedFilter`](forestadmin_datasource_toolkit.PaginatedFilter.md)\>

#### Overrides

CollectionDecorator.refineFilter

#### Defined in

[packages/datasource-toolkit/src/decorators/rename/collection.ts:69](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/decorators/rename/collection.ts#L69)

___

### refineSchema

▸ `Protected` **refineSchema**(`childSchema`): [`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema)

#### Parameters

| Name | Type |
| :------ | :------ |
| `childSchema` | [`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema) |

#### Returns

[`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema)

#### Overrides

CollectionDecorator.refineSchema

#### Defined in

[packages/datasource-toolkit/src/decorators/rename/collection.ts:46](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/decorators/rename/collection.ts#L46)

___

### renameField

▸ **renameField**(`currentName`, `newName`): `void`

Rename a field from the collection

#### Parameters

| Name | Type |
| :------ | :------ |
| `currentName` | `string` |
| `newName` | `string` |

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/decorators/rename/collection.ts:24](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/decorators/rename/collection.ts#L24)

___

### update

▸ **update**(`filter`, `patch`): `Promise`<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`Filter`](forestadmin_datasource_toolkit.Filter.md) |
| `patch` | [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata) |

#### Returns

`Promise`<`void`\>

#### Overrides

CollectionDecorator.update

#### Defined in

[packages/datasource-toolkit/src/decorators/rename/collection.ts:96](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/decorators/rename/collection.ts#L96)
