[root](../README.md) / [Modules](../modules.md) / [@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md) / BaseDataSource

# Class: BaseDataSource<T\>

[@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md).BaseDataSource

## Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`Collection`](../interfaces/forestadmin_datasource_toolkit.Collection.md) |

## Hierarchy

- **`BaseDataSource`**

  ↳ [`DataSourceDecorator`](forestadmin_datasource_toolkit.DataSourceDecorator.md)

## Implements

- [`DataSource`](../interfaces/forestadmin_datasource_toolkit.DataSource.md)

## Table of contents

### Constructors

- [constructor](forestadmin_datasource_toolkit.BaseDataSource.md#constructor)

### Properties

- [\_collections](forestadmin_datasource_toolkit.BaseDataSource.md#_collections)

### Accessors

- [collections](forestadmin_datasource_toolkit.BaseDataSource.md#collections)

### Methods

- [addCollection](forestadmin_datasource_toolkit.BaseDataSource.md#addcollection)
- [getCollection](forestadmin_datasource_toolkit.BaseDataSource.md#getcollection)

## Constructors

### constructor

• **new BaseDataSource**<`T`\>()

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`Collection`](../interfaces/forestadmin_datasource_toolkit.Collection.md) |

## Properties

### \_collections

• `Protected` **\_collections**: `Object` = `{}`

#### Index signature

▪ [collectionName: `string`]: `T`

#### Defined in

[packages/datasource-toolkit/src/base-datasource.ts:4](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/base-datasource.ts#L4)

## Accessors

### collections

• `get` **collections**(): `T`[]

#### Returns

`T`[]

#### Implementation of

DataSource.collections

#### Defined in

[packages/datasource-toolkit/src/base-datasource.ts:6](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/base-datasource.ts#L6)

## Methods

### addCollection

▸ **addCollection**(`collection`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `collection` | `T` |

#### Returns

`void`

#### Implementation of

[DataSource](../interfaces/forestadmin_datasource_toolkit.DataSource.md).[addCollection](../interfaces/forestadmin_datasource_toolkit.DataSource.md#addcollection)

#### Defined in

[packages/datasource-toolkit/src/base-datasource.ts:18](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/base-datasource.ts#L18)

___

### getCollection

▸ **getCollection**(`name`): `T`

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |

#### Returns

`T`

#### Implementation of

[DataSource](../interfaces/forestadmin_datasource_toolkit.DataSource.md).[getCollection](../interfaces/forestadmin_datasource_toolkit.DataSource.md#getcollection)

#### Defined in

[packages/datasource-toolkit/src/base-datasource.ts:10](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/base-datasource.ts#L10)
