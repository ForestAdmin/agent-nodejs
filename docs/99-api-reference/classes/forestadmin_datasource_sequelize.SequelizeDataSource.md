[root](../README.md) / [Modules](../modules.md) / [@forestadmin/datasource-sequelize](../modules/forestadmin_datasource_sequelize.md) / SequelizeDataSource

# Class: SequelizeDataSource

[@forestadmin/datasource-sequelize](../modules/forestadmin_datasource_sequelize.md).SequelizeDataSource

## Hierarchy

- `default`<[`SequelizeCollection`](forestadmin_datasource_sequelize.SequelizeCollection.md)\>

  ↳ **`SequelizeDataSource`**

## Table of contents

### Constructors

- [constructor](forestadmin_datasource_sequelize.SequelizeDataSource.md#constructor)

### Properties

- [\_collections](forestadmin_datasource_sequelize.SequelizeDataSource.md#_collections)
- [sequelize](forestadmin_datasource_sequelize.SequelizeDataSource.md#sequelize)

### Accessors

- [collections](forestadmin_datasource_sequelize.SequelizeDataSource.md#collections)

### Methods

- [addCollection](forestadmin_datasource_sequelize.SequelizeDataSource.md#addcollection)
- [getCollection](forestadmin_datasource_sequelize.SequelizeDataSource.md#getcollection)

## Constructors

### constructor

• **new SequelizeDataSource**(`sequelize`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `sequelize` | `Sequelize` |

#### Overrides

BaseDataSource&lt;SequelizeCollection\&gt;.constructor

#### Defined in

[packages/datasource-sequelize/src/datasource.ts:10](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-sequelize/src/datasource.ts#L10)

## Properties

### \_collections

• `Protected` **\_collections**: `Object`

#### Index signature

▪ [collectionName: `string`]: `T`

#### Inherited from

BaseDataSource.\_collections

#### Defined in

packages/datasource-toolkit/dist/src/base-datasource.d.ts:3

___

### sequelize

• `Protected` **sequelize**: `Sequelize` = `null`

#### Defined in

[packages/datasource-sequelize/src/datasource.ts:8](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-sequelize/src/datasource.ts#L8)

## Accessors

### collections

• `get` **collections**(): `T`[]

#### Returns

`T`[]

#### Inherited from

BaseDataSource.collections

#### Defined in

packages/datasource-toolkit/dist/src/base-datasource.d.ts:6

## Methods

### addCollection

▸ **addCollection**(`collection`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `collection` | [`SequelizeCollection`](forestadmin_datasource_sequelize.SequelizeCollection.md) |

#### Returns

`void`

#### Inherited from

BaseDataSource.addCollection

#### Defined in

packages/datasource-toolkit/dist/src/base-datasource.d.ts:8

___

### getCollection

▸ **getCollection**(`name`): [`SequelizeCollection`](forestadmin_datasource_sequelize.SequelizeCollection.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |

#### Returns

[`SequelizeCollection`](forestadmin_datasource_sequelize.SequelizeCollection.md)

#### Inherited from

BaseDataSource.getCollection

#### Defined in

packages/datasource-toolkit/dist/src/base-datasource.d.ts:7
