# Class: SequelizeDataSource

[@forestadmin/datasource-sequelize](../wiki/@forestadmin.datasource-sequelize).SequelizeDataSource

## Hierarchy

- `default`<[`SequelizeCollection`](../wiki/@forestadmin.datasource-sequelize.SequelizeCollection)\>

  ↳ **`SequelizeDataSource`**

## Table of contents

### Constructors

- [constructor](../wiki/@forestadmin.datasource-sequelize.SequelizeDataSource#constructor)

### Properties

- [\_collections](../wiki/@forestadmin.datasource-sequelize.SequelizeDataSource#_collections)
- [sequelize](../wiki/@forestadmin.datasource-sequelize.SequelizeDataSource#sequelize)

### Accessors

- [collections](../wiki/@forestadmin.datasource-sequelize.SequelizeDataSource#collections)

### Methods

- [addCollection](../wiki/@forestadmin.datasource-sequelize.SequelizeDataSource#addcollection)
- [getCollection](../wiki/@forestadmin.datasource-sequelize.SequelizeDataSource#getcollection)

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

[packages/datasource-sequelize/src/datasource.ts:10](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-sequelize/src/datasource.ts#L10)

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

[packages/datasource-sequelize/src/datasource.ts:8](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-sequelize/src/datasource.ts#L8)

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
| `collection` | [`SequelizeCollection`](../wiki/@forestadmin.datasource-sequelize.SequelizeCollection) |

#### Returns

`void`

#### Inherited from

BaseDataSource.addCollection

#### Defined in

packages/datasource-toolkit/dist/src/base-datasource.d.ts:8

___

### getCollection

▸ **getCollection**(`name`): [`SequelizeCollection`](../wiki/@forestadmin.datasource-sequelize.SequelizeCollection)

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |

#### Returns

[`SequelizeCollection`](../wiki/@forestadmin.datasource-sequelize.SequelizeCollection)

#### Inherited from

BaseDataSource.getCollection

#### Defined in

packages/datasource-toolkit/dist/src/base-datasource.d.ts:7
