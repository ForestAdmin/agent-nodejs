[root](../README.md) / [Modules](../modules.md) / [@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md) / JointureCollectionDecorator

# Class: JointureCollectionDecorator

[@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md).JointureCollectionDecorator

## Hierarchy

- `default`

  ↳ **`JointureCollectionDecorator`**

## Table of contents

### Constructors

- [constructor](forestadmin_datasource_toolkit.JointureCollectionDecorator.md#constructor)

### Properties

- [childCollection](forestadmin_datasource_toolkit.JointureCollectionDecorator.md#childcollection)
- [dataSource](forestadmin_datasource_toolkit.JointureCollectionDecorator.md#datasource)
- [jointures](forestadmin_datasource_toolkit.JointureCollectionDecorator.md#jointures)

### Accessors

- [name](forestadmin_datasource_toolkit.JointureCollectionDecorator.md#name)
- [schema](forestadmin_datasource_toolkit.JointureCollectionDecorator.md#schema)

### Methods

- [addJointure](forestadmin_datasource_toolkit.JointureCollectionDecorator.md#addjointure)
- [aggregate](forestadmin_datasource_toolkit.JointureCollectionDecorator.md#aggregate)
- [create](forestadmin_datasource_toolkit.JointureCollectionDecorator.md#create)
- [delete](forestadmin_datasource_toolkit.JointureCollectionDecorator.md#delete)
- [execute](forestadmin_datasource_toolkit.JointureCollectionDecorator.md#execute)
- [getForm](forestadmin_datasource_toolkit.JointureCollectionDecorator.md#getform)
- [list](forestadmin_datasource_toolkit.JointureCollectionDecorator.md#list)
- [refineFilter](forestadmin_datasource_toolkit.JointureCollectionDecorator.md#refinefilter)
- [refineSchema](forestadmin_datasource_toolkit.JointureCollectionDecorator.md#refineschema)
- [update](forestadmin_datasource_toolkit.JointureCollectionDecorator.md#update)

## Constructors

### constructor

• **new JointureCollectionDecorator**(`childCollection`, `dataSource`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `childCollection` | [`Collection`](../interfaces/forestadmin_datasource_toolkit.Collection.md) |
| `dataSource` | [`DataSource`](../interfaces/forestadmin_datasource_toolkit.DataSource.md) |

#### Inherited from

CollectionDecorator.constructor

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:14](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L14)

## Properties

### childCollection

• `Protected` **childCollection**: [`Collection`](../interfaces/forestadmin_datasource_toolkit.Collection.md)

#### Inherited from

CollectionDecorator.childCollection

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:12](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L12)

___

### dataSource

• `Readonly` **dataSource**: [`DataSourceDecorator`](forestadmin_datasource_toolkit.DataSourceDecorator.md)<[`JointureCollectionDecorator`](forestadmin_datasource_toolkit.JointureCollectionDecorator.md)\>

#### Overrides

CollectionDecorator.dataSource

#### Defined in

[packages/datasource-toolkit/src/decorators/jointure/collection.ts:21](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/jointure/collection.ts#L21)

___

### jointures

• `Protected` **jointures**: `Record`<`string`, [`RelationSchema`](../modules/forestadmin_datasource_toolkit.md#relationschema)\> = `{}`

#### Defined in

[packages/datasource-toolkit/src/decorators/jointure/collection.ts:22](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/jointure/collection.ts#L22)

## Accessors

### name

• `get` **name**(): `string`

#### Returns

`string`

#### Inherited from

CollectionDecorator.name

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:19](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L19)

___

### schema

• `get` **schema**(): [`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema)

#### Returns

[`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema)

#### Inherited from

CollectionDecorator.schema

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:23](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L23)

## Methods

### addJointure

▸ **addJointure**(`name`, `joint`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `joint` | [`RelationSchema`](../modules/forestadmin_datasource_toolkit.md#relationschema) |

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/decorators/jointure/collection.ts:24](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/jointure/collection.ts#L24)

___

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

[packages/datasource-toolkit/src/decorators/jointure/collection.ts:43](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/jointure/collection.ts#L43)

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

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:39](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L39)

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

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:55](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L55)

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

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:27](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L27)

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

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:33](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L33)

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

[packages/datasource-toolkit/src/decorators/jointure/collection.ts:33](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/jointure/collection.ts#L33)

___

### refineFilter

▸ `Protected` **refineFilter**(`filter`): `Promise`<[`PaginatedFilter`](forestadmin_datasource_toolkit.PaginatedFilter.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`PaginatedFilter`](forestadmin_datasource_toolkit.PaginatedFilter.md) |

#### Returns

`Promise`<[`PaginatedFilter`](forestadmin_datasource_toolkit.PaginatedFilter.md)\>

#### Overrides

CollectionDecorator.refineFilter

#### Defined in

[packages/datasource-toolkit/src/decorators/jointure/collection.ts:75](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/jointure/collection.ts#L75)

___

### refineSchema

▸ `Protected` **refineSchema**(`subSchema`): [`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema)

#### Parameters

| Name | Type |
| :------ | :------ |
| `subSchema` | [`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema) |

#### Returns

[`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema)

#### Overrides

CollectionDecorator.refineSchema

#### Defined in

[packages/datasource-toolkit/src/decorators/jointure/collection.ts:65](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/jointure/collection.ts#L65)

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

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:49](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L49)
