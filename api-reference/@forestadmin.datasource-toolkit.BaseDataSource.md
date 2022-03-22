# Class: BaseDataSource<T\>

[@forestadmin/datasource-toolkit](../wiki/@forestadmin.datasource-toolkit).BaseDataSource

## Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`Collection`](../wiki/@forestadmin.datasource-toolkit.Collection) |

## Hierarchy

- **`BaseDataSource`**

  ↳ [`DataSourceDecorator`](../wiki/@forestadmin.datasource-toolkit.DataSourceDecorator)

## Implements

- [`DataSource`](../wiki/@forestadmin.datasource-toolkit.DataSource)

## Table of contents

### Constructors

- [constructor](../wiki/@forestadmin.datasource-toolkit.BaseDataSource#constructor)

### Properties

- [\_collections](../wiki/@forestadmin.datasource-toolkit.BaseDataSource#_collections)

### Accessors

- [collections](../wiki/@forestadmin.datasource-toolkit.BaseDataSource#collections)

### Methods

- [addCollection](../wiki/@forestadmin.datasource-toolkit.BaseDataSource#addcollection)
- [getCollection](../wiki/@forestadmin.datasource-toolkit.BaseDataSource#getcollection)

## Constructors

### constructor

• **new BaseDataSource**<`T`\>()

#### Type parameters

| Name | Type |
| :------ | :------ |
| `T` | extends [`Collection`](../wiki/@forestadmin.datasource-toolkit.Collection) |

## Properties

### \_collections

• `Protected` **\_collections**: `Object` = `{}`

#### Index signature

▪ [collectionName: `string`]: `T`

#### Defined in

[packages/datasource-toolkit/src/base-datasource.ts:4](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/base-datasource.ts#L4)

## Accessors

### collections

• `get` **collections**(): `T`[]

#### Returns

`T`[]

#### Implementation of

DataSource.collections

#### Defined in

[packages/datasource-toolkit/src/base-datasource.ts:6](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/base-datasource.ts#L6)

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

[DataSource](../wiki/@forestadmin.datasource-toolkit.DataSource).[addCollection](../wiki/@forestadmin.datasource-toolkit.DataSource#addcollection)

#### Defined in

[packages/datasource-toolkit/src/base-datasource.ts:18](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/base-datasource.ts#L18)

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

[DataSource](../wiki/@forestadmin.datasource-toolkit.DataSource).[getCollection](../wiki/@forestadmin.datasource-toolkit.DataSource#getcollection)

#### Defined in

[packages/datasource-toolkit/src/base-datasource.ts:10](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/base-datasource.ts#L10)
