# Class: JointureCollectionDecorator

[@forestadmin/datasource-toolkit](../wiki/@forestadmin.datasource-toolkit).JointureCollectionDecorator

## Hierarchy

- `default`

  ↳ **`JointureCollectionDecorator`**

## Table of contents

### Constructors

- [constructor](../wiki/@forestadmin.datasource-toolkit.JointureCollectionDecorator#constructor)

### Properties

- [childCollection](../wiki/@forestadmin.datasource-toolkit.JointureCollectionDecorator#childcollection)
- [dataSource](../wiki/@forestadmin.datasource-toolkit.JointureCollectionDecorator#datasource)
- [jointures](../wiki/@forestadmin.datasource-toolkit.JointureCollectionDecorator#jointures)

### Accessors

- [name](../wiki/@forestadmin.datasource-toolkit.JointureCollectionDecorator#name)
- [schema](../wiki/@forestadmin.datasource-toolkit.JointureCollectionDecorator#schema)

### Methods

- [addJointure](../wiki/@forestadmin.datasource-toolkit.JointureCollectionDecorator#addjointure)
- [aggregate](../wiki/@forestadmin.datasource-toolkit.JointureCollectionDecorator#aggregate)
- [create](../wiki/@forestadmin.datasource-toolkit.JointureCollectionDecorator#create)
- [delete](../wiki/@forestadmin.datasource-toolkit.JointureCollectionDecorator#delete)
- [execute](../wiki/@forestadmin.datasource-toolkit.JointureCollectionDecorator#execute)
- [getForm](../wiki/@forestadmin.datasource-toolkit.JointureCollectionDecorator#getform)
- [list](../wiki/@forestadmin.datasource-toolkit.JointureCollectionDecorator#list)
- [refineFilter](../wiki/@forestadmin.datasource-toolkit.JointureCollectionDecorator#refinefilter)
- [refineSchema](../wiki/@forestadmin.datasource-toolkit.JointureCollectionDecorator#refineschema)
- [update](../wiki/@forestadmin.datasource-toolkit.JointureCollectionDecorator#update)

## Constructors

### constructor

• **new JointureCollectionDecorator**(`childCollection`, `dataSource`)

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

• `Readonly` **dataSource**: [`DataSourceDecorator`](../wiki/@forestadmin.datasource-toolkit.DataSourceDecorator)<[`JointureCollectionDecorator`](../wiki/@forestadmin.datasource-toolkit.JointureCollectionDecorator)\>

#### Overrides

CollectionDecorator.dataSource

#### Defined in

[packages/datasource-toolkit/src/decorators/jointure/collection.ts:21](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/jointure/collection.ts#L21)

___

### jointures

• `Protected` **jointures**: `Record`<`string`, [`RelationSchema`](../wiki/@forestadmin.datasource-toolkit#relationschema)\> = `{}`

#### Defined in

[packages/datasource-toolkit/src/decorators/jointure/collection.ts:22](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/jointure/collection.ts#L22)

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

### addJointure

▸ **addJointure**(`name`, `joint`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `joint` | [`RelationSchema`](../wiki/@forestadmin.datasource-toolkit#relationschema) |

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/decorators/jointure/collection.ts:24](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/jointure/collection.ts#L24)

___

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

[packages/datasource-toolkit/src/decorators/jointure/collection.ts:43](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/jointure/collection.ts#L43)

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

[packages/datasource-toolkit/src/decorators/jointure/collection.ts:33](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/jointure/collection.ts#L33)

___

### refineFilter

▸ `Protected` **refineFilter**(`filter`): `Promise`<[`PaginatedFilter`](../wiki/@forestadmin.datasource-toolkit.PaginatedFilter)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`PaginatedFilter`](../wiki/@forestadmin.datasource-toolkit.PaginatedFilter) |

#### Returns

`Promise`<[`PaginatedFilter`](../wiki/@forestadmin.datasource-toolkit.PaginatedFilter)\>

#### Overrides

CollectionDecorator.refineFilter

#### Defined in

[packages/datasource-toolkit/src/decorators/jointure/collection.ts:75](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/jointure/collection.ts#L75)

___

### refineSchema

▸ `Protected` **refineSchema**(`subSchema`): [`CollectionSchema`](../wiki/@forestadmin.datasource-toolkit#collectionschema)

#### Parameters

| Name | Type |
| :------ | :------ |
| `subSchema` | [`CollectionSchema`](../wiki/@forestadmin.datasource-toolkit#collectionschema) |

#### Returns

[`CollectionSchema`](../wiki/@forestadmin.datasource-toolkit#collectionschema)

#### Overrides

CollectionDecorator.refineSchema

#### Defined in

[packages/datasource-toolkit/src/decorators/jointure/collection.ts:65](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/jointure/collection.ts#L65)

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
