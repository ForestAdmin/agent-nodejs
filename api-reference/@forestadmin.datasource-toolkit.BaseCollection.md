# Class: BaseCollection

[@forestadmin/datasource-toolkit](../wiki/@forestadmin.datasource-toolkit).BaseCollection

## Implements

- [`Collection`](../wiki/@forestadmin.datasource-toolkit.Collection)

## Table of contents

### Constructors

- [constructor](../wiki/@forestadmin.datasource-toolkit.BaseCollection#constructor)

### Properties

- [dataSource](../wiki/@forestadmin.datasource-toolkit.BaseCollection#datasource)
- [name](../wiki/@forestadmin.datasource-toolkit.BaseCollection#name)
- [schema](../wiki/@forestadmin.datasource-toolkit.BaseCollection#schema)

### Methods

- [addAction](../wiki/@forestadmin.datasource-toolkit.BaseCollection#addaction)
- [addField](../wiki/@forestadmin.datasource-toolkit.BaseCollection#addfield)
- [addFields](../wiki/@forestadmin.datasource-toolkit.BaseCollection#addfields)
- [addSegments](../wiki/@forestadmin.datasource-toolkit.BaseCollection#addsegments)
- [aggregate](../wiki/@forestadmin.datasource-toolkit.BaseCollection#aggregate)
- [create](../wiki/@forestadmin.datasource-toolkit.BaseCollection#create)
- [delete](../wiki/@forestadmin.datasource-toolkit.BaseCollection#delete)
- [enableSearch](../wiki/@forestadmin.datasource-toolkit.BaseCollection#enablesearch)
- [execute](../wiki/@forestadmin.datasource-toolkit.BaseCollection#execute)
- [getForm](../wiki/@forestadmin.datasource-toolkit.BaseCollection#getform)
- [list](../wiki/@forestadmin.datasource-toolkit.BaseCollection#list)
- [update](../wiki/@forestadmin.datasource-toolkit.BaseCollection#update)

## Constructors

### constructor

• **new BaseCollection**(`name`, `datasource`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `datasource` | [`DataSource`](../wiki/@forestadmin.datasource-toolkit.DataSource) |

#### Defined in

[packages/datasource-toolkit/src/base-collection.ts:15](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/base-collection.ts#L15)

## Properties

### dataSource

• `Readonly` **dataSource**: [`DataSource`](../wiki/@forestadmin.datasource-toolkit.DataSource) = `null`

#### Implementation of

[Collection](../wiki/@forestadmin.datasource-toolkit.Collection).[dataSource](../wiki/@forestadmin.datasource-toolkit.Collection#datasource)

#### Defined in

[packages/datasource-toolkit/src/base-collection.ts:11](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/base-collection.ts#L11)

___

### name

• `Readonly` **name**: `string` = `null`

#### Implementation of

[Collection](../wiki/@forestadmin.datasource-toolkit.Collection).[name](../wiki/@forestadmin.datasource-toolkit.Collection#name)

#### Defined in

[packages/datasource-toolkit/src/base-collection.ts:12](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/base-collection.ts#L12)

___

### schema

• `Readonly` **schema**: [`CollectionSchema`](../wiki/@forestadmin.datasource-toolkit#collectionschema) = `null`

#### Implementation of

[Collection](../wiki/@forestadmin.datasource-toolkit.Collection).[schema](../wiki/@forestadmin.datasource-toolkit.Collection#schema)

#### Defined in

[packages/datasource-toolkit/src/base-collection.ts:13](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/base-collection.ts#L13)

## Methods

### addAction

▸ `Protected` **addAction**(`name`, `schema`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `schema` | [`ActionSchema`](../wiki/@forestadmin.datasource-toolkit#actionschema) |

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/base-collection.ts:26](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/base-collection.ts#L26)

___

### addField

▸ `Protected` **addField**(`name`, `schema`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `schema` | [`FieldSchema`](../wiki/@forestadmin.datasource-toolkit#fieldschema) |

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/base-collection.ts:34](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/base-collection.ts#L34)

___

### addFields

▸ `Protected` **addFields**(`fields`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `fields` | `Object` |

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/base-collection.ts:42](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/base-collection.ts#L42)

___

### addSegments

▸ `Protected` **addSegments**(`segments`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `segments` | `string`[] |

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/base-collection.ts:48](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/base-collection.ts#L48)

___

### aggregate

▸ `Abstract` **aggregate**(`filter`, `aggregation`, `limit?`): `Promise`<[`AggregateResult`](../wiki/@forestadmin.datasource-toolkit#aggregateresult)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`Filter`](../wiki/@forestadmin.datasource-toolkit.Filter) |
| `aggregation` | [`Aggregation`](../wiki/@forestadmin.datasource-toolkit.Aggregation) |
| `limit?` | `number` |

#### Returns

`Promise`<[`AggregateResult`](../wiki/@forestadmin.datasource-toolkit#aggregateresult)[]\>

#### Implementation of

[Collection](../wiki/@forestadmin.datasource-toolkit.Collection).[aggregate](../wiki/@forestadmin.datasource-toolkit.Collection#aggregate)

#### Defined in

[packages/datasource-toolkit/src/base-collection.ts:64](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/base-collection.ts#L64)

___

### create

▸ `Abstract` **create**(`data`): `Promise`<[`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `data` | [`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata)[] |

#### Returns

`Promise`<[`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata)[]\>

#### Implementation of

[Collection](../wiki/@forestadmin.datasource-toolkit.Collection).[create](../wiki/@forestadmin.datasource-toolkit.Collection#create)

#### Defined in

[packages/datasource-toolkit/src/base-collection.ts:56](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/base-collection.ts#L56)

___

### delete

▸ `Abstract` **delete**(`filter`): `Promise`<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`Filter`](../wiki/@forestadmin.datasource-toolkit.Filter) |

#### Returns

`Promise`<`void`\>

#### Implementation of

[Collection](../wiki/@forestadmin.datasource-toolkit.Collection).[delete](../wiki/@forestadmin.datasource-toolkit.Collection#delete)

#### Defined in

[packages/datasource-toolkit/src/base-collection.ts:62](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/base-collection.ts#L62)

___

### enableSearch

▸ `Protected` **enableSearch**(): `void`

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/base-collection.ts:52](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/base-collection.ts#L52)

___

### execute

▸ **execute**(`name`): `Promise`<[`ActionResult`](../wiki/@forestadmin.datasource-toolkit#actionresult)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |

#### Returns

`Promise`<[`ActionResult`](../wiki/@forestadmin.datasource-toolkit#actionresult)\>

#### Implementation of

[Collection](../wiki/@forestadmin.datasource-toolkit.Collection).[execute](../wiki/@forestadmin.datasource-toolkit.Collection#execute)

#### Defined in

[packages/datasource-toolkit/src/base-collection.ts:70](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/base-collection.ts#L70)

___

### getForm

▸ **getForm**(): `Promise`<[`ActionField`](../wiki/@forestadmin.datasource-toolkit.ActionField)[]\>

#### Returns

`Promise`<[`ActionField`](../wiki/@forestadmin.datasource-toolkit.ActionField)[]\>

#### Implementation of

[Collection](../wiki/@forestadmin.datasource-toolkit.Collection).[getForm](../wiki/@forestadmin.datasource-toolkit.Collection#getform)

#### Defined in

[packages/datasource-toolkit/src/base-collection.ts:78](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/base-collection.ts#L78)

___

### list

▸ `Abstract` **list**(`filter`, `projection`): `Promise`<[`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`PaginatedFilter`](../wiki/@forestadmin.datasource-toolkit.PaginatedFilter) |
| `projection` | [`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection) |

#### Returns

`Promise`<[`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata)[]\>

#### Implementation of

[Collection](../wiki/@forestadmin.datasource-toolkit.Collection).[list](../wiki/@forestadmin.datasource-toolkit.Collection#list)

#### Defined in

[packages/datasource-toolkit/src/base-collection.ts:58](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/base-collection.ts#L58)

___

### update

▸ `Abstract` **update**(`filter`, `patch`): `Promise`<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`Filter`](../wiki/@forestadmin.datasource-toolkit.Filter) |
| `patch` | [`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata) |

#### Returns

`Promise`<`void`\>

#### Implementation of

[Collection](../wiki/@forestadmin.datasource-toolkit.Collection).[update](../wiki/@forestadmin.datasource-toolkit.Collection#update)

#### Defined in

[packages/datasource-toolkit/src/base-collection.ts:60](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/base-collection.ts#L60)
