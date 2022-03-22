[root](../README.md) / [Modules](../modules.md) / [@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md) / BaseCollection

# Class: BaseCollection

[@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md).BaseCollection

## Implements

- [`Collection`](../interfaces/forestadmin_datasource_toolkit.Collection.md)

## Table of contents

### Constructors

- [constructor](forestadmin_datasource_toolkit.BaseCollection.md#constructor)

### Properties

- [dataSource](forestadmin_datasource_toolkit.BaseCollection.md#datasource)
- [name](forestadmin_datasource_toolkit.BaseCollection.md#name)
- [schema](forestadmin_datasource_toolkit.BaseCollection.md#schema)

### Methods

- [addAction](forestadmin_datasource_toolkit.BaseCollection.md#addaction)
- [addField](forestadmin_datasource_toolkit.BaseCollection.md#addfield)
- [addFields](forestadmin_datasource_toolkit.BaseCollection.md#addfields)
- [addSegments](forestadmin_datasource_toolkit.BaseCollection.md#addsegments)
- [aggregate](forestadmin_datasource_toolkit.BaseCollection.md#aggregate)
- [create](forestadmin_datasource_toolkit.BaseCollection.md#create)
- [delete](forestadmin_datasource_toolkit.BaseCollection.md#delete)
- [enableSearch](forestadmin_datasource_toolkit.BaseCollection.md#enablesearch)
- [execute](forestadmin_datasource_toolkit.BaseCollection.md#execute)
- [getForm](forestadmin_datasource_toolkit.BaseCollection.md#getform)
- [list](forestadmin_datasource_toolkit.BaseCollection.md#list)
- [update](forestadmin_datasource_toolkit.BaseCollection.md#update)

## Constructors

### constructor

• **new BaseCollection**(`name`, `datasource`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `datasource` | [`DataSource`](../interfaces/forestadmin_datasource_toolkit.DataSource.md) |

#### Defined in

[packages/datasource-toolkit/src/base-collection.ts:15](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/base-collection.ts#L15)

## Properties

### dataSource

• `Readonly` **dataSource**: [`DataSource`](../interfaces/forestadmin_datasource_toolkit.DataSource.md) = `null`

#### Implementation of

[Collection](../interfaces/forestadmin_datasource_toolkit.Collection.md).[dataSource](../interfaces/forestadmin_datasource_toolkit.Collection.md#datasource)

#### Defined in

[packages/datasource-toolkit/src/base-collection.ts:11](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/base-collection.ts#L11)

___

### name

• `Readonly` **name**: `string` = `null`

#### Implementation of

[Collection](../interfaces/forestadmin_datasource_toolkit.Collection.md).[name](../interfaces/forestadmin_datasource_toolkit.Collection.md#name)

#### Defined in

[packages/datasource-toolkit/src/base-collection.ts:12](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/base-collection.ts#L12)

___

### schema

• `Readonly` **schema**: [`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema) = `null`

#### Implementation of

[Collection](../interfaces/forestadmin_datasource_toolkit.Collection.md).[schema](../interfaces/forestadmin_datasource_toolkit.Collection.md#schema)

#### Defined in

[packages/datasource-toolkit/src/base-collection.ts:13](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/base-collection.ts#L13)

## Methods

### addAction

▸ `Protected` **addAction**(`name`, `schema`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `schema` | [`ActionSchema`](../modules/forestadmin_datasource_toolkit.md#actionschema) |

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/base-collection.ts:26](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/base-collection.ts#L26)

___

### addField

▸ `Protected` **addField**(`name`, `schema`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `schema` | [`FieldSchema`](../modules/forestadmin_datasource_toolkit.md#fieldschema) |

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/base-collection.ts:34](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/base-collection.ts#L34)

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

[packages/datasource-toolkit/src/base-collection.ts:42](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/base-collection.ts#L42)

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

[packages/datasource-toolkit/src/base-collection.ts:48](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/base-collection.ts#L48)

___

### aggregate

▸ `Abstract` **aggregate**(`filter`, `aggregation`, `limit?`): `Promise`<[`AggregateResult`](../modules/forestadmin_datasource_toolkit.md#aggregateresult)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`Filter`](forestadmin_datasource_toolkit.Filter.md) |
| `aggregation` | [`Aggregation`](forestadmin_datasource_toolkit.Aggregation.md) |
| `limit?` | `number` |

#### Returns

`Promise`<[`AggregateResult`](../modules/forestadmin_datasource_toolkit.md#aggregateresult)[]\>

#### Implementation of

[Collection](../interfaces/forestadmin_datasource_toolkit.Collection.md).[aggregate](../interfaces/forestadmin_datasource_toolkit.Collection.md#aggregate)

#### Defined in

[packages/datasource-toolkit/src/base-collection.ts:64](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/base-collection.ts#L64)

___

### create

▸ `Abstract` **create**(`data`): `Promise`<[`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `data` | [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[] |

#### Returns

`Promise`<[`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[]\>

#### Implementation of

[Collection](../interfaces/forestadmin_datasource_toolkit.Collection.md).[create](../interfaces/forestadmin_datasource_toolkit.Collection.md#create)

#### Defined in

[packages/datasource-toolkit/src/base-collection.ts:56](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/base-collection.ts#L56)

___

### delete

▸ `Abstract` **delete**(`filter`): `Promise`<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`Filter`](forestadmin_datasource_toolkit.Filter.md) |

#### Returns

`Promise`<`void`\>

#### Implementation of

[Collection](../interfaces/forestadmin_datasource_toolkit.Collection.md).[delete](../interfaces/forestadmin_datasource_toolkit.Collection.md#delete)

#### Defined in

[packages/datasource-toolkit/src/base-collection.ts:62](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/base-collection.ts#L62)

___

### enableSearch

▸ `Protected` **enableSearch**(): `void`

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/base-collection.ts:52](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/base-collection.ts#L52)

___

### execute

▸ **execute**(`name`): `Promise`<[`ActionResult`](../modules/forestadmin_datasource_toolkit.md#actionresult)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |

#### Returns

`Promise`<[`ActionResult`](../modules/forestadmin_datasource_toolkit.md#actionresult)\>

#### Implementation of

[Collection](../interfaces/forestadmin_datasource_toolkit.Collection.md).[execute](../interfaces/forestadmin_datasource_toolkit.Collection.md#execute)

#### Defined in

[packages/datasource-toolkit/src/base-collection.ts:70](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/base-collection.ts#L70)

___

### getForm

▸ **getForm**(): `Promise`<[`ActionField`](../interfaces/forestadmin_datasource_toolkit.ActionField.md)[]\>

#### Returns

`Promise`<[`ActionField`](../interfaces/forestadmin_datasource_toolkit.ActionField.md)[]\>

#### Implementation of

[Collection](../interfaces/forestadmin_datasource_toolkit.Collection.md).[getForm](../interfaces/forestadmin_datasource_toolkit.Collection.md#getform)

#### Defined in

[packages/datasource-toolkit/src/base-collection.ts:78](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/base-collection.ts#L78)

___

### list

▸ `Abstract` **list**(`filter`, `projection`): `Promise`<[`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`PaginatedFilter`](forestadmin_datasource_toolkit.PaginatedFilter.md) |
| `projection` | [`Projection`](forestadmin_datasource_toolkit.Projection.md) |

#### Returns

`Promise`<[`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[]\>

#### Implementation of

[Collection](../interfaces/forestadmin_datasource_toolkit.Collection.md).[list](../interfaces/forestadmin_datasource_toolkit.Collection.md#list)

#### Defined in

[packages/datasource-toolkit/src/base-collection.ts:58](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/base-collection.ts#L58)

___

### update

▸ `Abstract` **update**(`filter`, `patch`): `Promise`<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`Filter`](forestadmin_datasource_toolkit.Filter.md) |
| `patch` | [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata) |

#### Returns

`Promise`<`void`\>

#### Implementation of

[Collection](../interfaces/forestadmin_datasource_toolkit.Collection.md).[update](../interfaces/forestadmin_datasource_toolkit.Collection.md#update)

#### Defined in

[packages/datasource-toolkit/src/base-collection.ts:60](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/base-collection.ts#L60)
