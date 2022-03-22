[root](../README.md) / [Modules](../modules.md) / [@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md) / DataSourceDecorator

# Class: DataSourceDecorator<CollectionDecorator\>

[@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md).DataSourceDecorator

## Type parameters

| Name | Type |
| :------ | :------ |
| `CollectionDecorator` | extends [`Collection`](../interfaces/forestadmin_datasource_toolkit.Collection.md) |

## Hierarchy

- [`BaseDataSource`](forestadmin_datasource_toolkit.BaseDataSource.md)<`CollectionDecorator`\>

  ↳ **`DataSourceDecorator`**

## Table of contents

### Constructors

- [constructor](forestadmin_datasource_toolkit.DataSourceDecorator.md#constructor)

### Properties

- [\_collections](forestadmin_datasource_toolkit.DataSourceDecorator.md#_collections)

### Accessors

- [collections](forestadmin_datasource_toolkit.DataSourceDecorator.md#collections)

### Methods

- [addCollection](forestadmin_datasource_toolkit.DataSourceDecorator.md#addcollection)
- [addCollectionObserver](forestadmin_datasource_toolkit.DataSourceDecorator.md#addcollectionobserver)
- [getCollection](forestadmin_datasource_toolkit.DataSourceDecorator.md#getcollection)

## Constructors

### constructor

• **new DataSourceDecorator**<`CollectionDecorator`\>(`childDataSource`, `CollectionDecoratorCtor`)

#### Type parameters

| Name | Type |
| :------ | :------ |
| `CollectionDecorator` | extends [`Collection`](../interfaces/forestadmin_datasource_toolkit.Collection.md) |

#### Parameters

| Name | Type |
| :------ | :------ |
| `childDataSource` | [`DataSource`](../interfaces/forestadmin_datasource_toolkit.DataSource.md) |
| `CollectionDecoratorCtor` | `CollectionDecoratorConstructor`<`CollectionDecorator`\> |

#### Overrides

[BaseDataSource](forestadmin_datasource_toolkit.BaseDataSource.md).[constructor](forestadmin_datasource_toolkit.BaseDataSource.md#constructor)

#### Defined in

[packages/datasource-toolkit/src/decorators/datasource-decorator.ts:20](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/datasource-decorator.ts#L20)

## Properties

### \_collections

• `Protected` **\_collections**: `Object` = `{}`

#### Index signature

▪ [collectionName: `string`]: `T`

#### Inherited from

[BaseDataSource](forestadmin_datasource_toolkit.BaseDataSource.md).[_collections](forestadmin_datasource_toolkit.BaseDataSource.md#_collections)

#### Defined in

[packages/datasource-toolkit/src/base-datasource.ts:4](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/base-datasource.ts#L4)

## Accessors

### collections

• `get` **collections**(): `T`[]

#### Returns

`T`[]

#### Inherited from

BaseDataSource.collections

#### Defined in

[packages/datasource-toolkit/src/base-datasource.ts:6](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/base-datasource.ts#L6)

## Methods

### addCollection

▸ **addCollection**(`collection`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `collection` | `CollectionDecorator` |

#### Returns

`void`

#### Inherited from

[BaseDataSource](forestadmin_datasource_toolkit.BaseDataSource.md).[addCollection](forestadmin_datasource_toolkit.BaseDataSource.md#addcollection)

#### Defined in

[packages/datasource-toolkit/src/base-datasource.ts:18](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/base-datasource.ts#L18)

___

### addCollectionObserver

▸ **addCollectionObserver**(`collection`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `collection` | [`Collection`](../interfaces/forestadmin_datasource_toolkit.Collection.md) |

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/decorators/datasource-decorator.ts:15](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/datasource-decorator.ts#L15)

___

### getCollection

▸ **getCollection**(`name`): `CollectionDecorator`

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |

#### Returns

`CollectionDecorator`

#### Inherited from

[BaseDataSource](forestadmin_datasource_toolkit.BaseDataSource.md).[getCollection](forestadmin_datasource_toolkit.BaseDataSource.md#getcollection)

#### Defined in

[packages/datasource-toolkit/src/base-datasource.ts:10](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/base-datasource.ts#L10)
