[root](../README.md) / [Modules](../modules.md) / [@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md) / SegmentCollectionDecorator

# Class: SegmentCollectionDecorator

[@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md).SegmentCollectionDecorator

## Hierarchy

- `default`

  ↳ **`SegmentCollectionDecorator`**

## Table of contents

### Constructors

- [constructor](forestadmin_datasource_toolkit.SegmentCollectionDecorator.md#constructor)

### Properties

- [childCollection](forestadmin_datasource_toolkit.SegmentCollectionDecorator.md#childcollection)
- [dataSource](forestadmin_datasource_toolkit.SegmentCollectionDecorator.md#datasource)

### Accessors

- [name](forestadmin_datasource_toolkit.SegmentCollectionDecorator.md#name)
- [schema](forestadmin_datasource_toolkit.SegmentCollectionDecorator.md#schema)

### Methods

- [aggregate](forestadmin_datasource_toolkit.SegmentCollectionDecorator.md#aggregate)
- [create](forestadmin_datasource_toolkit.SegmentCollectionDecorator.md#create)
- [delete](forestadmin_datasource_toolkit.SegmentCollectionDecorator.md#delete)
- [execute](forestadmin_datasource_toolkit.SegmentCollectionDecorator.md#execute)
- [getForm](forestadmin_datasource_toolkit.SegmentCollectionDecorator.md#getform)
- [list](forestadmin_datasource_toolkit.SegmentCollectionDecorator.md#list)
- [refineFilter](forestadmin_datasource_toolkit.SegmentCollectionDecorator.md#refinefilter)
- [refineSchema](forestadmin_datasource_toolkit.SegmentCollectionDecorator.md#refineschema)
- [registerSegment](forestadmin_datasource_toolkit.SegmentCollectionDecorator.md#registersegment)
- [update](forestadmin_datasource_toolkit.SegmentCollectionDecorator.md#update)

## Constructors

### constructor

• **new SegmentCollectionDecorator**(`childCollection`, `dataSource`)

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

• `Readonly` **dataSource**: [`DataSource`](../interfaces/forestadmin_datasource_toolkit.DataSource.md)

#### Inherited from

CollectionDecorator.dataSource

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:11](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L11)

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

▸ **refineFilter**(`filter?`): `Promise`<[`PaginatedFilter`](forestadmin_datasource_toolkit.PaginatedFilter.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter?` | [`PaginatedFilter`](forestadmin_datasource_toolkit.PaginatedFilter.md) |

#### Returns

`Promise`<[`PaginatedFilter`](forestadmin_datasource_toolkit.PaginatedFilter.md)\>

#### Overrides

CollectionDecorator.refineFilter

#### Defined in

[packages/datasource-toolkit/src/decorators/segment/collection.ts:24](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/segment/collection.ts#L24)

___

### refineSchema

▸ `Protected` **refineSchema**(`subSchema`): [`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema)

#### Parameters

| Name | Type |
| :------ | :------ |
| `subSchema` | [`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema) |

#### Returns

[`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema)

#### Overrides

CollectionDecorator.refineSchema

#### Defined in

[packages/datasource-toolkit/src/decorators/segment/collection.ts:17](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/segment/collection.ts#L17)

___

### registerSegment

▸ **registerSegment**(`segmentName`, `getConditionTree`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `segmentName` | `string` |
| `getConditionTree` | `ConditionTreeGenerator` |

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/decorators/segment/collection.ts:13](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/segment/collection.ts#L13)

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
