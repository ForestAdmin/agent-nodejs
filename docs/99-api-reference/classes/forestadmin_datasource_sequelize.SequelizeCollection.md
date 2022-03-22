[root](../README.md) / [Modules](../modules.md) / [@forestadmin/datasource-sequelize](../modules/forestadmin_datasource_sequelize.md) / SequelizeCollection

# Class: SequelizeCollection

[@forestadmin/datasource-sequelize](../modules/forestadmin_datasource_sequelize.md).SequelizeCollection

## Hierarchy

- `default`

  ↳ **`SequelizeCollection`**

## Table of contents

### Constructors

- [constructor](forestadmin_datasource_sequelize.SequelizeCollection.md#constructor)

### Properties

- [dataSource](forestadmin_datasource_sequelize.SequelizeCollection.md#datasource)
- [model](forestadmin_datasource_sequelize.SequelizeCollection.md#model)
- [name](forestadmin_datasource_sequelize.SequelizeCollection.md#name)
- [schema](forestadmin_datasource_sequelize.SequelizeCollection.md#schema)

### Methods

- [addAction](forestadmin_datasource_sequelize.SequelizeCollection.md#addaction)
- [addField](forestadmin_datasource_sequelize.SequelizeCollection.md#addfield)
- [addFields](forestadmin_datasource_sequelize.SequelizeCollection.md#addfields)
- [addSegments](forestadmin_datasource_sequelize.SequelizeCollection.md#addsegments)
- [aggregate](forestadmin_datasource_sequelize.SequelizeCollection.md#aggregate)
- [create](forestadmin_datasource_sequelize.SequelizeCollection.md#create)
- [delete](forestadmin_datasource_sequelize.SequelizeCollection.md#delete)
- [enableSearch](forestadmin_datasource_sequelize.SequelizeCollection.md#enablesearch)
- [execute](forestadmin_datasource_sequelize.SequelizeCollection.md#execute)
- [getForm](forestadmin_datasource_sequelize.SequelizeCollection.md#getform)
- [list](forestadmin_datasource_sequelize.SequelizeCollection.md#list)
- [update](forestadmin_datasource_sequelize.SequelizeCollection.md#update)

## Constructors

### constructor

• **new SequelizeCollection**(`name`, `datasource`, `model`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `datasource` | `DataSource` |
| `model` | `ModelDefined`<`any`, `any`\> |

#### Overrides

BaseCollection.constructor

#### Defined in

[packages/datasource-sequelize/src/collection.ts:25](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-sequelize/src/collection.ts#L25)

## Properties

### dataSource

• `Readonly` **dataSource**: `DataSource`

#### Inherited from

BaseCollection.dataSource

#### Defined in

packages/datasource-toolkit/dist/src/base-collection.d.ts:10

___

### model

• `Protected` **model**: `ModelDefined`<`any`, `any`\>

#### Defined in

[packages/datasource-sequelize/src/collection.ts:21](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-sequelize/src/collection.ts#L21)

___

### name

• `Readonly` **name**: `string`

#### Inherited from

BaseCollection.name

#### Defined in

packages/datasource-toolkit/dist/src/base-collection.d.ts:11

___

### schema

• `Readonly` **schema**: `CollectionSchema`

#### Inherited from

BaseCollection.schema

#### Defined in

packages/datasource-toolkit/dist/src/base-collection.d.ts:12

## Methods

### addAction

▸ `Protected` **addAction**(`name`, `schema`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `schema` | `ActionSchema` |

#### Returns

`void`

#### Inherited from

BaseCollection.addAction

#### Defined in

packages/datasource-toolkit/dist/src/base-collection.d.ts:14

___

### addField

▸ `Protected` **addField**(`name`, `schema`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `schema` | `FieldSchema` |

#### Returns

`void`

#### Inherited from

BaseCollection.addField

#### Defined in

packages/datasource-toolkit/dist/src/base-collection.d.ts:15

___

### addFields

▸ `Protected` **addFields**(`fields`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `fields` | `Object` |

#### Returns

`void`

#### Inherited from

BaseCollection.addFields

#### Defined in

packages/datasource-toolkit/dist/src/base-collection.d.ts:16

___

### addSegments

▸ `Protected` **addSegments**(`segments`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `segments` | `string`[] |

#### Returns

`void`

#### Inherited from

BaseCollection.addSegments

#### Defined in

packages/datasource-toolkit/dist/src/base-collection.d.ts:19

___

### aggregate

▸ **aggregate**(`filter`, `aggregation`, `limit?`): `Promise`<`AggregateResult`[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | `default` |
| `aggregation` | `default` |
| `limit?` | `number` |

#### Returns

`Promise`<`AggregateResult`[]\>

#### Overrides

BaseCollection.aggregate

#### Defined in

[packages/datasource-sequelize/src/collection.ts:82](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-sequelize/src/collection.ts#L82)

___

### create

▸ **create**(`data`): `Promise`<`RecordData`[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `data` | `RecordData`[] |

#### Returns

`Promise`<`RecordData`[]\>

#### Overrides

BaseCollection.create

#### Defined in

[packages/datasource-sequelize/src/collection.ts:39](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-sequelize/src/collection.ts#L39)

___

### delete

▸ **delete**(`filter`): `Promise`<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | `default` |

#### Returns

`Promise`<`void`\>

#### Overrides

BaseCollection.delete

#### Defined in

[packages/datasource-sequelize/src/collection.ts:76](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-sequelize/src/collection.ts#L76)

___

### enableSearch

▸ `Protected` **enableSearch**(): `void`

#### Returns

`void`

#### Inherited from

BaseCollection.enableSearch

#### Defined in

packages/datasource-toolkit/dist/src/base-collection.d.ts:20

___

### execute

▸ **execute**(`name`): `Promise`<`ActionResult`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |

#### Returns

`Promise`<`ActionResult`\>

#### Inherited from

BaseCollection.execute

#### Defined in

packages/datasource-toolkit/dist/src/base-collection.d.ts:26

___

### getForm

▸ **getForm**(): `Promise`<`ActionField`[]\>

#### Returns

`Promise`<`ActionField`[]\>

#### Inherited from

BaseCollection.getForm

#### Defined in

packages/datasource-toolkit/dist/src/base-collection.d.ts:27

___

### list

▸ **list**(`filter`, `projection`): `Promise`<`RecordData`[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | `default` |
| `projection` | `default` |

#### Returns

`Promise`<`RecordData`[]\>

#### Overrides

BaseCollection.list

#### Defined in

[packages/datasource-sequelize/src/collection.ts:45](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-sequelize/src/collection.ts#L45)

___

### update

▸ **update**(`filter`, `patch`): `Promise`<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | `default` |
| `patch` | `RecordData` |

#### Returns

`Promise`<`void`\>

#### Overrides

BaseCollection.update

#### Defined in

[packages/datasource-sequelize/src/collection.ts:69](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-sequelize/src/collection.ts#L69)
