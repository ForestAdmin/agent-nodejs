# Class: DataSourceDecorator<CollectionDecorator\>

[@forestadmin/datasource-toolkit](../wiki/@forestadmin.datasource-toolkit).DataSourceDecorator

## Type parameters

| Name | Type |
| :------ | :------ |
| `CollectionDecorator` | extends [`Collection`](../wiki/@forestadmin.datasource-toolkit.Collection) |

## Hierarchy

- [`BaseDataSource`](../wiki/@forestadmin.datasource-toolkit.BaseDataSource)<`CollectionDecorator`\>

  ↳ **`DataSourceDecorator`**

## Table of contents

### Constructors

- [constructor](../wiki/@forestadmin.datasource-toolkit.DataSourceDecorator#constructor)

### Properties

- [\_collections](../wiki/@forestadmin.datasource-toolkit.DataSourceDecorator#_collections)

### Accessors

- [collections](../wiki/@forestadmin.datasource-toolkit.DataSourceDecorator#collections)

### Methods

- [addCollection](../wiki/@forestadmin.datasource-toolkit.DataSourceDecorator#addcollection)
- [addCollectionObserver](../wiki/@forestadmin.datasource-toolkit.DataSourceDecorator#addcollectionobserver)
- [getCollection](../wiki/@forestadmin.datasource-toolkit.DataSourceDecorator#getcollection)

## Constructors

### constructor

• **new DataSourceDecorator**<`CollectionDecorator`\>(`childDataSource`, `CollectionDecoratorCtor`)

#### Type parameters

| Name | Type |
| :------ | :------ |
| `CollectionDecorator` | extends [`Collection`](../wiki/@forestadmin.datasource-toolkit.Collection) |

#### Parameters

| Name | Type |
| :------ | :------ |
| `childDataSource` | [`DataSource`](../wiki/@forestadmin.datasource-toolkit.DataSource) |
| `CollectionDecoratorCtor` | `CollectionDecoratorConstructor`<`CollectionDecorator`\> |

#### Overrides

[BaseDataSource](../wiki/@forestadmin.datasource-toolkit.BaseDataSource).[constructor](../wiki/@forestadmin.datasource-toolkit.BaseDataSource#constructor)

#### Defined in

[packages/datasource-toolkit/src/decorators/datasource-decorator.ts:20](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/datasource-decorator.ts#L20)

## Properties

### \_collections

• `Protected` **\_collections**: `Object` = `{}`

#### Index signature

▪ [collectionName: `string`]: `T`

#### Inherited from

[BaseDataSource](../wiki/@forestadmin.datasource-toolkit.BaseDataSource).[_collections](../wiki/@forestadmin.datasource-toolkit.BaseDataSource#_collections)

#### Defined in

[packages/datasource-toolkit/src/base-datasource.ts:4](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/base-datasource.ts#L4)

## Accessors

### collections

• `get` **collections**(): `T`[]

#### Returns

`T`[]

#### Inherited from

BaseDataSource.collections

#### Defined in

[packages/datasource-toolkit/src/base-datasource.ts:6](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/base-datasource.ts#L6)

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

[BaseDataSource](../wiki/@forestadmin.datasource-toolkit.BaseDataSource).[addCollection](../wiki/@forestadmin.datasource-toolkit.BaseDataSource#addcollection)

#### Defined in

[packages/datasource-toolkit/src/base-datasource.ts:18](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/base-datasource.ts#L18)

___

### addCollectionObserver

▸ **addCollectionObserver**(`collection`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `collection` | [`Collection`](../wiki/@forestadmin.datasource-toolkit.Collection) |

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/decorators/datasource-decorator.ts:15](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/datasource-decorator.ts#L15)

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

[BaseDataSource](../wiki/@forestadmin.datasource-toolkit.BaseDataSource).[getCollection](../wiki/@forestadmin.datasource-toolkit.BaseDataSource#getcollection)

#### Defined in

[packages/datasource-toolkit/src/base-datasource.ts:10](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/base-datasource.ts#L10)
