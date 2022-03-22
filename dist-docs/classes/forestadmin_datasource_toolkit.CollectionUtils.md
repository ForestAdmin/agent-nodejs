[root](../README.md) / [Modules](../modules.md) / [@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md) / CollectionUtils

# Class: CollectionUtils

[@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md).CollectionUtils

## Table of contents

### Constructors

- [constructor](forestadmin_datasource_toolkit.CollectionUtils.md#constructor)

### Methods

- [aggregateRelation](forestadmin_datasource_toolkit.CollectionUtils.md#aggregaterelation)
- [getCollectionFromToManyRelation](forestadmin_datasource_toolkit.CollectionUtils.md#getcollectionfromtomanyrelation)
- [getFieldSchema](forestadmin_datasource_toolkit.CollectionUtils.md#getfieldschema)
- [getInverseRelation](forestadmin_datasource_toolkit.CollectionUtils.md#getinverserelation)
- [listRelation](forestadmin_datasource_toolkit.CollectionUtils.md#listrelation)

## Constructors

### constructor

• **new CollectionUtils**()

## Methods

### aggregateRelation

▸ `Static` **aggregateRelation**(`collection`, `id`, `relationName`, `paginatedFilter`, `aggregation`): `Promise`<[`AggregateResult`](../modules/forestadmin_datasource_toolkit.md#aggregateresult)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `collection` | [`Collection`](../interfaces/forestadmin_datasource_toolkit.Collection.md) |
| `id` | [`CompositeId`](../modules/forestadmin_datasource_toolkit.md#compositeid) |
| `relationName` | `string` |
| `paginatedFilter` | [`PaginatedFilter`](forestadmin_datasource_toolkit.PaginatedFilter.md) |
| `aggregation` | [`Aggregation`](forestadmin_datasource_toolkit.Aggregation.md) |

#### Returns

`Promise`<[`AggregateResult`](../modules/forestadmin_datasource_toolkit.md#aggregateresult)[]\>

#### Defined in

[packages/datasource-toolkit/src/utils/collection.ts:113](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/utils/collection.ts#L113)

___

### getCollectionFromToManyRelation

▸ `Static` **getCollectionFromToManyRelation**(`collection`, `relation`): [`Collection`](../interfaces/forestadmin_datasource_toolkit.Collection.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `collection` | [`Collection`](../interfaces/forestadmin_datasource_toolkit.Collection.md) |
| `relation` | [`OneToManySchema`](../modules/forestadmin_datasource_toolkit.md#onetomanyschema) \| [`ManyToManySchema`](../modules/forestadmin_datasource_toolkit.md#manytomanyschema) |

#### Returns

[`Collection`](../interfaces/forestadmin_datasource_toolkit.Collection.md)

#### Defined in

[packages/datasource-toolkit/src/utils/collection.ts:143](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/utils/collection.ts#L143)

___

### getFieldSchema

▸ `Static` **getFieldSchema**(`collection`, `path`): [`FieldSchema`](../modules/forestadmin_datasource_toolkit.md#fieldschema)

#### Parameters

| Name | Type |
| :------ | :------ |
| `collection` | [`Collection`](../interfaces/forestadmin_datasource_toolkit.Collection.md) |
| `path` | `string` |

#### Returns

[`FieldSchema`](../modules/forestadmin_datasource_toolkit.md#fieldschema)

#### Defined in

[packages/datasource-toolkit/src/utils/collection.ts:19](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/utils/collection.ts#L19)

___

### getInverseRelation

▸ `Static` **getInverseRelation**(`collection`, `relationName`): `string`

#### Parameters

| Name | Type |
| :------ | :------ |
| `collection` | [`Collection`](../interfaces/forestadmin_datasource_toolkit.Collection.md) |
| `relationName` | `string` |

#### Returns

`string`

#### Defined in

[packages/datasource-toolkit/src/utils/collection.ts:48](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/utils/collection.ts#L48)

___

### listRelation

▸ `Static` **listRelation**(`collection`, `id`, `relationName`, `paginatedFilter`, `projection`): `Promise`<[`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `collection` | [`Collection`](../interfaces/forestadmin_datasource_toolkit.Collection.md) |
| `id` | [`CompositeId`](../modules/forestadmin_datasource_toolkit.md#compositeid) |
| `relationName` | `string` |
| `paginatedFilter` | [`PaginatedFilter`](forestadmin_datasource_toolkit.PaginatedFilter.md) |
| `projection` | [`Projection`](forestadmin_datasource_toolkit.Projection.md) |

#### Returns

`Promise`<[`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[]\>

#### Defined in

[packages/datasource-toolkit/src/utils/collection.ts:80](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/utils/collection.ts#L80)
