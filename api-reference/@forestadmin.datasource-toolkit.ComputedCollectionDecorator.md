# Class: ComputedCollectionDecorator

[@forestadmin/datasource-toolkit](../wiki/@forestadmin.datasource-toolkit).ComputedCollectionDecorator

Decorator injects computed fields

## Hierarchy

- `default`

  ↳ **`ComputedCollectionDecorator`**

## Table of contents

### Constructors

- [constructor](../wiki/@forestadmin.datasource-toolkit.ComputedCollectionDecorator#constructor)

### Properties

- [childCollection](../wiki/@forestadmin.datasource-toolkit.ComputedCollectionDecorator#childcollection)
- [computeds](../wiki/@forestadmin.datasource-toolkit.ComputedCollectionDecorator#computeds)
- [dataSource](../wiki/@forestadmin.datasource-toolkit.ComputedCollectionDecorator#datasource)

### Accessors

- [name](../wiki/@forestadmin.datasource-toolkit.ComputedCollectionDecorator#name)
- [schema](../wiki/@forestadmin.datasource-toolkit.ComputedCollectionDecorator#schema)

### Methods

- [aggregate](../wiki/@forestadmin.datasource-toolkit.ComputedCollectionDecorator#aggregate)
- [create](../wiki/@forestadmin.datasource-toolkit.ComputedCollectionDecorator#create)
- [delete](../wiki/@forestadmin.datasource-toolkit.ComputedCollectionDecorator#delete)
- [execute](../wiki/@forestadmin.datasource-toolkit.ComputedCollectionDecorator#execute)
- [getForm](../wiki/@forestadmin.datasource-toolkit.ComputedCollectionDecorator#getform)
- [list](../wiki/@forestadmin.datasource-toolkit.ComputedCollectionDecorator#list)
- [refineFilter](../wiki/@forestadmin.datasource-toolkit.ComputedCollectionDecorator#refinefilter)
- [refineSchema](../wiki/@forestadmin.datasource-toolkit.ComputedCollectionDecorator#refineschema)
- [registerComputed](../wiki/@forestadmin.datasource-toolkit.ComputedCollectionDecorator#registercomputed)
- [registerProxy](../wiki/@forestadmin.datasource-toolkit.ComputedCollectionDecorator#registerproxy)
- [update](../wiki/@forestadmin.datasource-toolkit.ComputedCollectionDecorator#update)

## Constructors

### constructor

• **new ComputedCollectionDecorator**(`childCollection`, `dataSource`)

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

### computeds

• `Protected` **computeds**: `Record`<`string`, [`ComputedDefinition`](../wiki/@forestadmin.datasource-toolkit.ComputedDefinition)\> = `{}`

#### Defined in

[packages/datasource-toolkit/src/decorators/computed/collection.ts:24](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/computed/collection.ts#L24)

___

### dataSource

• `Readonly` **dataSource**: [`DataSourceDecorator`](../wiki/@forestadmin.datasource-toolkit.DataSourceDecorator)<[`ComputedCollectionDecorator`](../wiki/@forestadmin.datasource-toolkit.ComputedCollectionDecorator)\>

#### Overrides

CollectionDecorator.dataSource

#### Defined in

[packages/datasource-toolkit/src/decorators/computed/collection.ts:23](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/computed/collection.ts#L23)

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

[packages/datasource-toolkit/src/decorators/computed/collection.ts:60](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/computed/collection.ts#L60)

___

### create

▸ **create**(`data`): `Promise`<[`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `data` | [`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata)[] |

#### Returns

`Promise`<[`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata)[]\>

#### Inherited from

CollectionDecorator.create

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:39](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L39)

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

[packages/datasource-toolkit/src/decorators/computed/collection.ts:53](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/computed/collection.ts#L53)

___

### refineFilter

▸ `Protected` **refineFilter**(`filter?`): `Promise`<[`PaginatedFilter`](../wiki/@forestadmin.datasource-toolkit.PaginatedFilter)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter?` | [`PaginatedFilter`](../wiki/@forestadmin.datasource-toolkit.PaginatedFilter) |

#### Returns

`Promise`<[`PaginatedFilter`](../wiki/@forestadmin.datasource-toolkit.PaginatedFilter)\>

#### Inherited from

CollectionDecorator.refineFilter

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:71](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L71)

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

[packages/datasource-toolkit/src/decorators/computed/collection.ts:74](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/computed/collection.ts#L74)

___

### registerComputed

▸ **registerComputed**(`name`, `computed`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `computed` | [`ComputedDefinition`](../wiki/@forestadmin.datasource-toolkit.ComputedDefinition) |

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/decorators/computed/collection.ts:37](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/computed/collection.ts#L37)

___

### registerProxy

▸ **registerProxy**(`name`, `proxy`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `proxy` | [`ProxyDefinition`](../wiki/@forestadmin.datasource-toolkit.ProxyDefinition) |

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/decorators/computed/collection.ts:46](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/computed/collection.ts#L46)

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

#### Inherited from

CollectionDecorator.update

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:49](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L49)
