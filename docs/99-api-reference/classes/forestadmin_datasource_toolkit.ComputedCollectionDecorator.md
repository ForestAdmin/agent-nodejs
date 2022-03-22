[root](../README.md) / [Modules](../modules.md) / [@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md) / ComputedCollectionDecorator

# Class: ComputedCollectionDecorator

[@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md).ComputedCollectionDecorator

Decorator injects computed fields

## Hierarchy

- `default`

  ↳ **`ComputedCollectionDecorator`**

## Table of contents

### Constructors

- [constructor](forestadmin_datasource_toolkit.ComputedCollectionDecorator.md#constructor)

### Properties

- [childCollection](forestadmin_datasource_toolkit.ComputedCollectionDecorator.md#childcollection)
- [computeds](forestadmin_datasource_toolkit.ComputedCollectionDecorator.md#computeds)
- [dataSource](forestadmin_datasource_toolkit.ComputedCollectionDecorator.md#datasource)

### Accessors

- [name](forestadmin_datasource_toolkit.ComputedCollectionDecorator.md#name)
- [schema](forestadmin_datasource_toolkit.ComputedCollectionDecorator.md#schema)

### Methods

- [aggregate](forestadmin_datasource_toolkit.ComputedCollectionDecorator.md#aggregate)
- [create](forestadmin_datasource_toolkit.ComputedCollectionDecorator.md#create)
- [delete](forestadmin_datasource_toolkit.ComputedCollectionDecorator.md#delete)
- [execute](forestadmin_datasource_toolkit.ComputedCollectionDecorator.md#execute)
- [getForm](forestadmin_datasource_toolkit.ComputedCollectionDecorator.md#getform)
- [list](forestadmin_datasource_toolkit.ComputedCollectionDecorator.md#list)
- [refineFilter](forestadmin_datasource_toolkit.ComputedCollectionDecorator.md#refinefilter)
- [refineSchema](forestadmin_datasource_toolkit.ComputedCollectionDecorator.md#refineschema)
- [registerComputed](forestadmin_datasource_toolkit.ComputedCollectionDecorator.md#registercomputed)
- [registerProxy](forestadmin_datasource_toolkit.ComputedCollectionDecorator.md#registerproxy)
- [update](forestadmin_datasource_toolkit.ComputedCollectionDecorator.md#update)

## Constructors

### constructor

• **new ComputedCollectionDecorator**(`childCollection`, `dataSource`)

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

### computeds

• `Protected` **computeds**: `Record`<`string`, [`ComputedDefinition`](../interfaces/forestadmin_datasource_toolkit.ComputedDefinition.md)\> = `{}`

#### Defined in

[packages/datasource-toolkit/src/decorators/computed/collection.ts:24](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/decorators/computed/collection.ts#L24)

___

### dataSource

• `Readonly` **dataSource**: [`DataSourceDecorator`](forestadmin_datasource_toolkit.DataSourceDecorator.md)<[`ComputedCollectionDecorator`](forestadmin_datasource_toolkit.ComputedCollectionDecorator.md)\>

#### Overrides

CollectionDecorator.dataSource

#### Defined in

[packages/datasource-toolkit/src/decorators/computed/collection.ts:23](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/decorators/computed/collection.ts#L23)

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

[packages/datasource-toolkit/src/decorators/computed/collection.ts:60](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/decorators/computed/collection.ts#L60)

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

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:39](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L39)

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

[packages/datasource-toolkit/src/decorators/computed/collection.ts:53](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/decorators/computed/collection.ts#L53)

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

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:71](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L71)

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

[packages/datasource-toolkit/src/decorators/computed/collection.ts:74](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/decorators/computed/collection.ts#L74)

___

### registerComputed

▸ **registerComputed**(`name`, `computed`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `computed` | [`ComputedDefinition`](../interfaces/forestadmin_datasource_toolkit.ComputedDefinition.md) |

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/decorators/computed/collection.ts:37](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/decorators/computed/collection.ts#L37)

___

### registerProxy

▸ **registerProxy**(`name`, `proxy`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `proxy` | [`ProxyDefinition`](../interfaces/forestadmin_datasource_toolkit.ProxyDefinition.md) |

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/decorators/computed/collection.ts:46](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/decorators/computed/collection.ts#L46)

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

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:49](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L49)
