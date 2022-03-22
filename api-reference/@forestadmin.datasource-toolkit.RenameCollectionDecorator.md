# Class: RenameCollectionDecorator

[@forestadmin/datasource-toolkit](../wiki/@forestadmin.datasource-toolkit).RenameCollectionDecorator

This decorator renames fields.

It works on one side, by rewriting all references to fields in aggregations, filters, projections
and on the other, by rewriting records and aggregation results which are returned by the
subCollection.

## Hierarchy

- `default`

  ↳ **`RenameCollectionDecorator`**

## Table of contents

### Constructors

- [constructor](../wiki/@forestadmin.datasource-toolkit.RenameCollectionDecorator#constructor)

### Properties

- [childCollection](../wiki/@forestadmin.datasource-toolkit.RenameCollectionDecorator#childcollection)
- [dataSource](../wiki/@forestadmin.datasource-toolkit.RenameCollectionDecorator#datasource)

### Accessors

- [name](../wiki/@forestadmin.datasource-toolkit.RenameCollectionDecorator#name)
- [schema](../wiki/@forestadmin.datasource-toolkit.RenameCollectionDecorator#schema)

### Methods

- [aggregate](../wiki/@forestadmin.datasource-toolkit.RenameCollectionDecorator#aggregate)
- [create](../wiki/@forestadmin.datasource-toolkit.RenameCollectionDecorator#create)
- [delete](../wiki/@forestadmin.datasource-toolkit.RenameCollectionDecorator#delete)
- [execute](../wiki/@forestadmin.datasource-toolkit.RenameCollectionDecorator#execute)
- [getForm](../wiki/@forestadmin.datasource-toolkit.RenameCollectionDecorator#getform)
- [list](../wiki/@forestadmin.datasource-toolkit.RenameCollectionDecorator#list)
- [refineFilter](../wiki/@forestadmin.datasource-toolkit.RenameCollectionDecorator#refinefilter)
- [refineSchema](../wiki/@forestadmin.datasource-toolkit.RenameCollectionDecorator#refineschema)
- [renameField](../wiki/@forestadmin.datasource-toolkit.RenameCollectionDecorator#renamefield)
- [update](../wiki/@forestadmin.datasource-toolkit.RenameCollectionDecorator#update)

## Constructors

### constructor

• **new RenameCollectionDecorator**(`childCollection`, `dataSource`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `childCollection` | [`Collection`](../wiki/@forestadmin.datasource-toolkit.Collection) |
| `dataSource` | [`DataSource`](../wiki/@forestadmin.datasource-toolkit.DataSource) |

#### Inherited from

CollectionDecorator.constructor

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:14](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L14)

## Properties

### childCollection

• `Protected` **childCollection**: [`Collection`](../wiki/@forestadmin.datasource-toolkit.Collection)

#### Inherited from

CollectionDecorator.childCollection

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:12](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L12)

___

### dataSource

• `Readonly` **dataSource**: [`DataSourceDecorator`](../wiki/@forestadmin.datasource-toolkit.DataSourceDecorator)<[`RenameCollectionDecorator`](../wiki/@forestadmin.datasource-toolkit.RenameCollectionDecorator)\>

#### Overrides

CollectionDecorator.dataSource

#### Defined in

[packages/datasource-toolkit/src/decorators/rename/collection.ts:18](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/rename/collection.ts#L18)

## Accessors

### name

• `get` **name**(): `string`

#### Returns

`string`

#### Inherited from

CollectionDecorator.name

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:19](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L19)

___

### schema

• `get` **schema**(): [`CollectionSchema`](../wiki/@forestadmin.datasource-toolkit#collectionschema)

#### Returns

[`CollectionSchema`](../wiki/@forestadmin.datasource-toolkit#collectionschema)

#### Inherited from

CollectionDecorator.schema

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:23](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L23)

## Methods

### aggregate

▸ **aggregate**(`filter`, `aggregation`, `limit?`): `Promise`<[`AggregateResult`](../wiki/@forestadmin.datasource-toolkit#aggregateresult)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`Filter`](../wiki/@forestadmin.datasource-toolkit.Filter) |
| `aggregation` | [`Aggregation`](../wiki/@forestadmin.datasource-toolkit.Aggregation) |
| `limit?` | `number` |

#### Returns

`Promise`<[`AggregateResult`](../wiki/@forestadmin.datasource-toolkit#aggregateresult)[]\>

#### Overrides

CollectionDecorator.aggregate

#### Defined in

[packages/datasource-toolkit/src/decorators/rename/collection.ts:100](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/rename/collection.ts#L100)

___

### create

▸ **create**(`records`): `Promise`<[`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `records` | [`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata)[] |

#### Returns

`Promise`<[`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata)[]\>

#### Overrides

CollectionDecorator.create

#### Defined in

[packages/datasource-toolkit/src/decorators/rename/collection.ts:81](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/rename/collection.ts#L81)

___

### delete

▸ **delete**(`filter`): `Promise`<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`Filter`](../wiki/@forestadmin.datasource-toolkit.Filter) |

#### Returns

`Promise`<`void`\>

#### Inherited from

CollectionDecorator.delete

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:55](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L55)

___

### execute

▸ **execute**(`name`, `data`, `filter?`): `Promise`<[`ActionResult`](../wiki/@forestadmin.datasource-toolkit#actionresult)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `data` | [`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata) |
| `filter?` | [`Filter`](../wiki/@forestadmin.datasource-toolkit.Filter) |

#### Returns

`Promise`<[`ActionResult`](../wiki/@forestadmin.datasource-toolkit#actionresult)\>

#### Inherited from

CollectionDecorator.execute

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:27](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L27)

___

### getForm

▸ **getForm**(`name`, `data?`, `filter?`): `Promise`<[`ActionField`](../wiki/@forestadmin.datasource-toolkit.ActionField)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `data?` | [`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata) |
| `filter?` | [`Filter`](../wiki/@forestadmin.datasource-toolkit.Filter) |

#### Returns

`Promise`<[`ActionField`](../wiki/@forestadmin.datasource-toolkit.ActionField)[]\>

#### Inherited from

CollectionDecorator.getForm

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:33](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L33)

___

### list

▸ **list**(`filter`, `projection`): `Promise`<[`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`PaginatedFilter`](../wiki/@forestadmin.datasource-toolkit.PaginatedFilter) |
| `projection` | [`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection) |

#### Returns

`Promise`<[`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata)[]\>

#### Overrides

CollectionDecorator.list

#### Defined in

[packages/datasource-toolkit/src/decorators/rename/collection.ts:89](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/rename/collection.ts#L89)

___

### refineFilter

▸ `Protected` **refineFilter**(`filter?`): `Promise`<[`PaginatedFilter`](../wiki/@forestadmin.datasource-toolkit.PaginatedFilter)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter?` | [`PaginatedFilter`](../wiki/@forestadmin.datasource-toolkit.PaginatedFilter) |

#### Returns

`Promise`<[`PaginatedFilter`](../wiki/@forestadmin.datasource-toolkit.PaginatedFilter)\>

#### Overrides

CollectionDecorator.refineFilter

#### Defined in

[packages/datasource-toolkit/src/decorators/rename/collection.ts:69](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/rename/collection.ts#L69)

___

### refineSchema

▸ `Protected` **refineSchema**(`childSchema`): [`CollectionSchema`](../wiki/@forestadmin.datasource-toolkit#collectionschema)

#### Parameters

| Name | Type |
| :------ | :------ |
| `childSchema` | [`CollectionSchema`](../wiki/@forestadmin.datasource-toolkit#collectionschema) |

#### Returns

[`CollectionSchema`](../wiki/@forestadmin.datasource-toolkit#collectionschema)

#### Overrides

CollectionDecorator.refineSchema

#### Defined in

[packages/datasource-toolkit/src/decorators/rename/collection.ts:46](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/rename/collection.ts#L46)

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

[packages/datasource-toolkit/src/decorators/rename/collection.ts:24](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/rename/collection.ts#L24)

___

### update

▸ **update**(`filter`, `patch`): `Promise`<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`Filter`](../wiki/@forestadmin.datasource-toolkit.Filter) |
| `patch` | [`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata) |

#### Returns

`Promise`<`void`\>

#### Overrides

CollectionDecorator.update

#### Defined in

[packages/datasource-toolkit/src/decorators/rename/collection.ts:96](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/rename/collection.ts#L96)
