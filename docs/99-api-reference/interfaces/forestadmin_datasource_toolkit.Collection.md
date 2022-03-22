[root](../README.md) / [Modules](../modules.md) / [@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md) / Collection

# Interface: Collection

[@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md).Collection

## Implemented by

- [`BaseCollection`](../classes/forestadmin_datasource_toolkit.BaseCollection.md)

## Table of contents

### Accessors

- [dataSource](forestadmin_datasource_toolkit.Collection.md#datasource)
- [name](forestadmin_datasource_toolkit.Collection.md#name)
- [schema](forestadmin_datasource_toolkit.Collection.md#schema)

### Methods

- [aggregate](forestadmin_datasource_toolkit.Collection.md#aggregate)
- [create](forestadmin_datasource_toolkit.Collection.md#create)
- [delete](forestadmin_datasource_toolkit.Collection.md#delete)
- [execute](forestadmin_datasource_toolkit.Collection.md#execute)
- [getForm](forestadmin_datasource_toolkit.Collection.md#getform)
- [list](forestadmin_datasource_toolkit.Collection.md#list)
- [update](forestadmin_datasource_toolkit.Collection.md#update)

## Accessors

### dataSource

• `get` **dataSource**(): [`DataSource`](forestadmin_datasource_toolkit.DataSource.md)

#### Returns

[`DataSource`](forestadmin_datasource_toolkit.DataSource.md)

#### Defined in

[packages/datasource-toolkit/src/interfaces/collection.ts:16](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/collection.ts#L16)

___

### name

• `get` **name**(): `string`

#### Returns

`string`

#### Defined in

[packages/datasource-toolkit/src/interfaces/collection.ts:17](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/collection.ts#L17)

___

### schema

• `get` **schema**(): [`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema)

#### Returns

[`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema)

#### Defined in

[packages/datasource-toolkit/src/interfaces/collection.ts:18](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/collection.ts#L18)

## Methods

### aggregate

▸ **aggregate**(`filter`, `aggregation`, `limit?`): `Promise`<[`AggregateResult`](../modules/forestadmin_datasource_toolkit.md#aggregateresult)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`Filter`](../classes/forestadmin_datasource_toolkit.Filter.md) |
| `aggregation` | [`Aggregation`](../classes/forestadmin_datasource_toolkit.Aggregation.md) |
| `limit?` | `number` |

#### Returns

`Promise`<[`AggregateResult`](../modules/forestadmin_datasource_toolkit.md#aggregateresult)[]\>

#### Defined in

[packages/datasource-toolkit/src/interfaces/collection.ts:32](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/collection.ts#L32)

___

### create

▸ **create**(`data`): `Promise`<[`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `data` | [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[] |

#### Returns

`Promise`<[`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[]\>

#### Defined in

[packages/datasource-toolkit/src/interfaces/collection.ts:24](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/collection.ts#L24)

___

### delete

▸ **delete**(`filter`): `Promise`<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`Filter`](../classes/forestadmin_datasource_toolkit.Filter.md) |

#### Returns

`Promise`<`void`\>

#### Defined in

[packages/datasource-toolkit/src/interfaces/collection.ts:30](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/collection.ts#L30)

___

### execute

▸ **execute**(`name`, `formValues`, `filter?`): `Promise`<[`ActionResult`](../modules/forestadmin_datasource_toolkit.md#actionresult)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `formValues` | [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata) |
| `filter?` | [`Filter`](../classes/forestadmin_datasource_toolkit.Filter.md) |

#### Returns

`Promise`<[`ActionResult`](../modules/forestadmin_datasource_toolkit.md#actionresult)\>

#### Defined in

[packages/datasource-toolkit/src/interfaces/collection.ts:20](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/collection.ts#L20)

___

### getForm

▸ **getForm**(`name`, `formValues?`, `filter?`): `Promise`<[`ActionField`](forestadmin_datasource_toolkit.ActionField.md)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `formValues?` | [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata) |
| `filter?` | [`Filter`](../classes/forestadmin_datasource_toolkit.Filter.md) |

#### Returns

`Promise`<[`ActionField`](forestadmin_datasource_toolkit.ActionField.md)[]\>

#### Defined in

[packages/datasource-toolkit/src/interfaces/collection.ts:22](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/collection.ts#L22)

___

### list

▸ **list**(`filter`, `projection`): `Promise`<[`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`PaginatedFilter`](../classes/forestadmin_datasource_toolkit.PaginatedFilter.md) |
| `projection` | [`Projection`](../classes/forestadmin_datasource_toolkit.Projection.md) |

#### Returns

`Promise`<[`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[]\>

#### Defined in

[packages/datasource-toolkit/src/interfaces/collection.ts:26](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/collection.ts#L26)

___

### update

▸ **update**(`filter`, `patch`): `Promise`<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`Filter`](../classes/forestadmin_datasource_toolkit.Filter.md) |
| `patch` | [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata) |

#### Returns

`Promise`<`void`\>

#### Defined in

[packages/datasource-toolkit/src/interfaces/collection.ts:28](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/collection.ts#L28)
