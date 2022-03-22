[root](../README.md) / [Modules](../modules.md) / [@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md) / PublicationCollectionDecorator

# Class: PublicationCollectionDecorator

[@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md).PublicationCollectionDecorator

This decorator allows hiding fields

## Hierarchy

- `default`

  ↳ **`PublicationCollectionDecorator`**

## Table of contents

### Constructors

- [constructor](forestadmin_datasource_toolkit.PublicationCollectionDecorator.md#constructor)

### Properties

- [childCollection](forestadmin_datasource_toolkit.PublicationCollectionDecorator.md#childcollection)
- [dataSource](forestadmin_datasource_toolkit.PublicationCollectionDecorator.md#datasource)

### Accessors

- [name](forestadmin_datasource_toolkit.PublicationCollectionDecorator.md#name)
- [schema](forestadmin_datasource_toolkit.PublicationCollectionDecorator.md#schema)

### Methods

- [aggregate](forestadmin_datasource_toolkit.PublicationCollectionDecorator.md#aggregate)
- [changeFieldVisibility](forestadmin_datasource_toolkit.PublicationCollectionDecorator.md#changefieldvisibility)
- [create](forestadmin_datasource_toolkit.PublicationCollectionDecorator.md#create)
- [delete](forestadmin_datasource_toolkit.PublicationCollectionDecorator.md#delete)
- [execute](forestadmin_datasource_toolkit.PublicationCollectionDecorator.md#execute)
- [getForm](forestadmin_datasource_toolkit.PublicationCollectionDecorator.md#getform)
- [list](forestadmin_datasource_toolkit.PublicationCollectionDecorator.md#list)
- [refineFilter](forestadmin_datasource_toolkit.PublicationCollectionDecorator.md#refinefilter)
- [refineSchema](forestadmin_datasource_toolkit.PublicationCollectionDecorator.md#refineschema)
- [update](forestadmin_datasource_toolkit.PublicationCollectionDecorator.md#update)

## Constructors

### constructor

• **new PublicationCollectionDecorator**(`childCollection`, `dataSource`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `childCollection` | [`Collection`](../interfaces/forestadmin_datasource_toolkit.Collection.md) |
| `dataSource` | [`DataSource`](../interfaces/forestadmin_datasource_toolkit.DataSource.md) |

#### Inherited from

CollectionDecorator.constructor

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:14](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L14)

## Properties

### childCollection

• `Protected` **childCollection**: [`Collection`](../interfaces/forestadmin_datasource_toolkit.Collection.md)

#### Inherited from

CollectionDecorator.childCollection

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:12](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L12)

___

### dataSource

• `Readonly` **dataSource**: [`DataSourceDecorator`](forestadmin_datasource_toolkit.DataSourceDecorator.md)<[`PublicationCollectionDecorator`](forestadmin_datasource_toolkit.PublicationCollectionDecorator.md)\>

#### Overrides

CollectionDecorator.dataSource

#### Defined in

[packages/datasource-toolkit/src/decorators/publication/collection.ts:7](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/publication/collection.ts#L7)

## Accessors

### name

• `get` **name**(): `string`

#### Returns

`string`

#### Inherited from

CollectionDecorator.name

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:19](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L19)

___

### schema

• `get` **schema**(): [`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema)

#### Returns

[`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema)

#### Inherited from

CollectionDecorator.schema

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:23](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L23)

## Methods

### aggregate

▸ **aggregate**(`filter`, `aggregation`, `limit?`): `Promise`<[`AggregateResult`](../modules/forestadmin_datasource_toolkit.md#aggregateresult)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`Filter`](forestadmin_datasource_toolkit.Filter.md) |
| `aggregation` | [`Aggregation`](forestadmin_datasource_toolkit.Aggregation.md) |
| `limit?` | `number` |

#### Returns

`Promise`<[`AggregateResult`](../modules/forestadmin_datasource_toolkit.md#aggregateresult)[]\>

#### Inherited from

CollectionDecorator.aggregate

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:61](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L61)

___

### changeFieldVisibility

▸ **changeFieldVisibility**(`name`, `visible`): `void`

Show/hide fields from the schema

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `visible` | `boolean` |

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/decorators/publication/collection.ts:11](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/publication/collection.ts#L11)

___

### create

▸ **create**(`data`): `Promise`<[`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `data` | [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[] |

#### Returns

`Promise`<[`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[]\>

#### Inherited from

CollectionDecorator.create

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:39](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L39)

___

### delete

▸ **delete**(`filter`): `Promise`<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`Filter`](forestadmin_datasource_toolkit.Filter.md) |

#### Returns

`Promise`<`void`\>

#### Inherited from

CollectionDecorator.delete

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:55](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L55)

___

### execute

▸ **execute**(`name`, `data`, `filter?`): `Promise`<[`ActionResult`](../modules/forestadmin_datasource_toolkit.md#actionresult)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `data` | [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata) |
| `filter?` | [`Filter`](forestadmin_datasource_toolkit.Filter.md) |

#### Returns

`Promise`<[`ActionResult`](../modules/forestadmin_datasource_toolkit.md#actionresult)\>

#### Inherited from

CollectionDecorator.execute

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:27](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L27)

___

### getForm

▸ **getForm**(`name`, `data?`, `filter?`): `Promise`<[`ActionField`](../interfaces/forestadmin_datasource_toolkit.ActionField.md)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `data?` | [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata) |
| `filter?` | [`Filter`](forestadmin_datasource_toolkit.Filter.md) |

#### Returns

`Promise`<[`ActionField`](../interfaces/forestadmin_datasource_toolkit.ActionField.md)[]\>

#### Inherited from

CollectionDecorator.getForm

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:33](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L33)

___

### list

▸ **list**(`filter`, `projection`): `Promise`<[`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`PaginatedFilter`](forestadmin_datasource_toolkit.PaginatedFilter.md) |
| `projection` | [`Projection`](forestadmin_datasource_toolkit.Projection.md) |

#### Returns

`Promise`<[`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[]\>

#### Inherited from

CollectionDecorator.list

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:43](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L43)

___

### refineFilter

▸ `Protected` **refineFilter**(`filter?`): `Promise`<[`PaginatedFilter`](forestadmin_datasource_toolkit.PaginatedFilter.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter?` | [`PaginatedFilter`](forestadmin_datasource_toolkit.PaginatedFilter.md) |

#### Returns

`Promise`<[`PaginatedFilter`](forestadmin_datasource_toolkit.PaginatedFilter.md)\>

#### Inherited from

CollectionDecorator.refineFilter

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:71](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L71)

___

### refineSchema

▸ `Protected` **refineSchema**(`childSchema`): [`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema)

#### Parameters

| Name | Type |
| :------ | :------ |
| `childSchema` | [`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema) |

#### Returns

[`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema)

#### Overrides

CollectionDecorator.refineSchema

#### Defined in

[packages/datasource-toolkit/src/decorators/publication/collection.ts:26](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/publication/collection.ts#L26)

___

### update

▸ **update**(`filter`, `patch`): `Promise`<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`Filter`](forestadmin_datasource_toolkit.Filter.md) |
| `patch` | [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata) |

#### Returns

`Promise`<`void`\>

#### Inherited from

CollectionDecorator.update

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:49](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L49)
