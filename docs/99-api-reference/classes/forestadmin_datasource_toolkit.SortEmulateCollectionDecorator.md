[root](../README.md) / [Modules](../modules.md) / [@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md) / SortEmulateCollectionDecorator

# Class: SortEmulateCollectionDecorator

[@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md).SortEmulateCollectionDecorator

## Hierarchy

- `default`

  ↳ **`SortEmulateCollectionDecorator`**

## Table of contents

### Constructors

- [constructor](forestadmin_datasource_toolkit.SortEmulateCollectionDecorator.md#constructor)

### Properties

- [childCollection](forestadmin_datasource_toolkit.SortEmulateCollectionDecorator.md#childcollection)
- [dataSource](forestadmin_datasource_toolkit.SortEmulateCollectionDecorator.md#datasource)

### Accessors

- [name](forestadmin_datasource_toolkit.SortEmulateCollectionDecorator.md#name)
- [schema](forestadmin_datasource_toolkit.SortEmulateCollectionDecorator.md#schema)

### Methods

- [aggregate](forestadmin_datasource_toolkit.SortEmulateCollectionDecorator.md#aggregate)
- [create](forestadmin_datasource_toolkit.SortEmulateCollectionDecorator.md#create)
- [delete](forestadmin_datasource_toolkit.SortEmulateCollectionDecorator.md#delete)
- [emulateSort](forestadmin_datasource_toolkit.SortEmulateCollectionDecorator.md#emulatesort)
- [execute](forestadmin_datasource_toolkit.SortEmulateCollectionDecorator.md#execute)
- [getForm](forestadmin_datasource_toolkit.SortEmulateCollectionDecorator.md#getform)
- [implementSort](forestadmin_datasource_toolkit.SortEmulateCollectionDecorator.md#implementsort)
- [list](forestadmin_datasource_toolkit.SortEmulateCollectionDecorator.md#list)
- [refineFilter](forestadmin_datasource_toolkit.SortEmulateCollectionDecorator.md#refinefilter)
- [refineSchema](forestadmin_datasource_toolkit.SortEmulateCollectionDecorator.md#refineschema)
- [update](forestadmin_datasource_toolkit.SortEmulateCollectionDecorator.md#update)

## Constructors

### constructor

• **new SortEmulateCollectionDecorator**(`childCollection`, `dataSource`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `childCollection` | [`Collection`](../interfaces/forestadmin_datasource_toolkit.Collection.md) |
| `dataSource` | [`DataSource`](../interfaces/forestadmin_datasource_toolkit.DataSource.md) |

#### Inherited from

CollectionDecorator.constructor

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:14](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L14)

## Properties

### childCollection

• `Protected` **childCollection**: [`Collection`](../interfaces/forestadmin_datasource_toolkit.Collection.md)

#### Inherited from

CollectionDecorator.childCollection

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:12](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L12)

___

### dataSource

• `Readonly` **dataSource**: [`DataSourceDecorator`](forestadmin_datasource_toolkit.DataSourceDecorator.md)<[`SortEmulateCollectionDecorator`](forestadmin_datasource_toolkit.SortEmulateCollectionDecorator.md)\>

#### Overrides

CollectionDecorator.dataSource

#### Defined in

[packages/datasource-toolkit/src/decorators/sort-emulate/collection.ts:20](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/decorators/sort-emulate/collection.ts#L20)

## Accessors

### name

• `get` **name**(): `string`

#### Returns

`string`

#### Inherited from

CollectionDecorator.name

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:19](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L19)

___

### schema

• `get` **schema**(): [`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema)

#### Returns

[`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema)

#### Inherited from

CollectionDecorator.schema

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:23](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L23)

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

#### Inherited from

CollectionDecorator.aggregate

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:61](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L61)

___

### create

▸ **create**(`data`): `Promise`<[`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `data` | [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[] |

#### Returns

`Promise`<[`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[]\>

#### Inherited from

CollectionDecorator.create

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:39](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L39)

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

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:55](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L55)

___

### emulateSort

▸ **emulateSort**(`name`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/decorators/sort-emulate/collection.ts:23](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/decorators/sort-emulate/collection.ts#L23)

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

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:27](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L27)

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

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:33](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L33)

___

### implementSort

▸ **implementSort**(`name`, `equivalentSort`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `equivalentSort` | [`Sort`](forestadmin_datasource_toolkit.Sort.md) |

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/decorators/sort-emulate/collection.ts:27](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/decorators/sort-emulate/collection.ts#L27)

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

[packages/datasource-toolkit/src/decorators/sort-emulate/collection.ts:36](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/decorators/sort-emulate/collection.ts#L36)

___

### refineFilter

▸ `Protected` **refineFilter**(`filter?`): `Promise`<[`PaginatedFilter`](forestadmin_datasource_toolkit.PaginatedFilter.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter?` | [`PaginatedFilter`](forestadmin_datasource_toolkit.PaginatedFilter.md) |

#### Returns

`Promise`<[`PaginatedFilter`](forestadmin_datasource_toolkit.PaginatedFilter.md)\>

#### Inherited from

CollectionDecorator.refineFilter

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:71](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L71)

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

[packages/datasource-toolkit/src/decorators/sort-emulate/collection.ts:67](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/decorators/sort-emulate/collection.ts#L67)

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

#### Inherited from

CollectionDecorator.update

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:49](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L49)
