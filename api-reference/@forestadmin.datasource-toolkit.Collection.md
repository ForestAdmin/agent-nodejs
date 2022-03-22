# Interface: Collection

[@forestadmin/datasource-toolkit](../wiki/@forestadmin.datasource-toolkit).Collection

## Implemented by

- [`BaseCollection`](../wiki/@forestadmin.datasource-toolkit.BaseCollection)

## Table of contents

### Accessors

- [dataSource](../wiki/@forestadmin.datasource-toolkit.Collection#datasource)
- [name](../wiki/@forestadmin.datasource-toolkit.Collection#name)
- [schema](../wiki/@forestadmin.datasource-toolkit.Collection#schema)

### Methods

- [aggregate](../wiki/@forestadmin.datasource-toolkit.Collection#aggregate)
- [create](../wiki/@forestadmin.datasource-toolkit.Collection#create)
- [delete](../wiki/@forestadmin.datasource-toolkit.Collection#delete)
- [execute](../wiki/@forestadmin.datasource-toolkit.Collection#execute)
- [getForm](../wiki/@forestadmin.datasource-toolkit.Collection#getform)
- [list](../wiki/@forestadmin.datasource-toolkit.Collection#list)
- [update](../wiki/@forestadmin.datasource-toolkit.Collection#update)

## Accessors

### dataSource

• `get` **dataSource**(): [`DataSource`](../wiki/@forestadmin.datasource-toolkit.DataSource)

#### Returns

[`DataSource`](../wiki/@forestadmin.datasource-toolkit.DataSource)

#### Defined in

[packages/datasource-toolkit/src/interfaces/collection.ts:16](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/collection.ts#L16)

___

### name

• `get` **name**(): `string`

#### Returns

`string`

#### Defined in

[packages/datasource-toolkit/src/interfaces/collection.ts:17](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/collection.ts#L17)

___

### schema

• `get` **schema**(): [`CollectionSchema`](../wiki/@forestadmin.datasource-toolkit#collectionschema)

#### Returns

[`CollectionSchema`](../wiki/@forestadmin.datasource-toolkit#collectionschema)

#### Defined in

[packages/datasource-toolkit/src/interfaces/collection.ts:18](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/collection.ts#L18)

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

#### Defined in

[packages/datasource-toolkit/src/interfaces/collection.ts:32](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/collection.ts#L32)

___

### create

▸ **create**(`data`): `Promise`<[`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `data` | [`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata)[] |

#### Returns

`Promise`<[`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata)[]\>

#### Defined in

[packages/datasource-toolkit/src/interfaces/collection.ts:24](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/collection.ts#L24)

___

### delete

▸ **delete**(`filter`): `Promise`<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`Filter`](../wiki/@forestadmin.datasource-toolkit.Filter) |

#### Returns

`Promise`<`void`\>

#### Defined in

[packages/datasource-toolkit/src/interfaces/collection.ts:30](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/collection.ts#L30)

___

### execute

▸ **execute**(`name`, `formValues`, `filter?`): `Promise`<[`ActionResult`](../wiki/@forestadmin.datasource-toolkit#actionresult)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `formValues` | [`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata) |
| `filter?` | [`Filter`](../wiki/@forestadmin.datasource-toolkit.Filter) |

#### Returns

`Promise`<[`ActionResult`](../wiki/@forestadmin.datasource-toolkit#actionresult)\>

#### Defined in

[packages/datasource-toolkit/src/interfaces/collection.ts:20](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/collection.ts#L20)

___

### getForm

▸ **getForm**(`name`, `formValues?`, `filter?`): `Promise`<[`ActionField`](../wiki/@forestadmin.datasource-toolkit.ActionField)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `formValues?` | [`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata) |
| `filter?` | [`Filter`](../wiki/@forestadmin.datasource-toolkit.Filter) |

#### Returns

`Promise`<[`ActionField`](../wiki/@forestadmin.datasource-toolkit.ActionField)[]\>

#### Defined in

[packages/datasource-toolkit/src/interfaces/collection.ts:22](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/collection.ts#L22)

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

#### Defined in

[packages/datasource-toolkit/src/interfaces/collection.ts:26](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/collection.ts#L26)

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

#### Defined in

[packages/datasource-toolkit/src/interfaces/collection.ts:28](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/collection.ts#L28)
