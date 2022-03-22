# Interface: DataSource

[@forestadmin/datasource-toolkit](../wiki/@forestadmin.datasource-toolkit).DataSource

## Implemented by

- [`BaseDataSource`](../wiki/@forestadmin.datasource-toolkit.BaseDataSource)

## Table of contents

### Accessors

- [collections](../wiki/@forestadmin.datasource-toolkit.DataSource#collections)

### Methods

- [addCollection](../wiki/@forestadmin.datasource-toolkit.DataSource#addcollection)
- [getCollection](../wiki/@forestadmin.datasource-toolkit.DataSource#getcollection)

## Accessors

### collections

• `get` **collections**(): [`Collection`](../wiki/@forestadmin.datasource-toolkit.Collection)[]

#### Returns

[`Collection`](../wiki/@forestadmin.datasource-toolkit.Collection)[]

#### Defined in

[packages/datasource-toolkit/src/interfaces/collection.ts:10](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/collection.ts#L10)

## Methods

### addCollection

▸ **addCollection**(`collection`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `collection` | [`Collection`](../wiki/@forestadmin.datasource-toolkit.Collection) |

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/interfaces/collection.ts:12](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/collection.ts#L12)

___

### getCollection

▸ **getCollection**(`name`): [`Collection`](../wiki/@forestadmin.datasource-toolkit.Collection)

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |

#### Returns

[`Collection`](../wiki/@forestadmin.datasource-toolkit.Collection)

#### Defined in

[packages/datasource-toolkit/src/interfaces/collection.ts:11](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/collection.ts#L11)
