[root](../README.md) / [Modules](../modules.md) / [@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md) / DataSource

# Interface: DataSource

[@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md).DataSource

## Implemented by

- [`BaseDataSource`](../classes/forestadmin_datasource_toolkit.BaseDataSource.md)

## Table of contents

### Accessors

- [collections](forestadmin_datasource_toolkit.DataSource.md#collections)

### Methods

- [addCollection](forestadmin_datasource_toolkit.DataSource.md#addcollection)
- [getCollection](forestadmin_datasource_toolkit.DataSource.md#getcollection)

## Accessors

### collections

• `get` **collections**(): [`Collection`](forestadmin_datasource_toolkit.Collection.md)[]

#### Returns

[`Collection`](forestadmin_datasource_toolkit.Collection.md)[]

#### Defined in

[packages/datasource-toolkit/src/interfaces/collection.ts:10](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/collection.ts#L10)

## Methods

### addCollection

▸ **addCollection**(`collection`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `collection` | [`Collection`](forestadmin_datasource_toolkit.Collection.md) |

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/interfaces/collection.ts:12](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/collection.ts#L12)

___

### getCollection

▸ **getCollection**(`name`): [`Collection`](forestadmin_datasource_toolkit.Collection.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |

#### Returns

[`Collection`](forestadmin_datasource_toolkit.Collection.md)

#### Defined in

[packages/datasource-toolkit/src/interfaces/collection.ts:11](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/collection.ts#L11)
