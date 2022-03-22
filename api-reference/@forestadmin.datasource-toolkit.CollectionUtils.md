# Class: CollectionUtils

[@forestadmin/datasource-toolkit](../wiki/@forestadmin.datasource-toolkit).CollectionUtils

## Table of contents

### Constructors

- [constructor](../wiki/@forestadmin.datasource-toolkit.CollectionUtils#constructor)

### Methods

- [aggregateRelation](../wiki/@forestadmin.datasource-toolkit.CollectionUtils#aggregaterelation)
- [getCollectionFromToManyRelation](../wiki/@forestadmin.datasource-toolkit.CollectionUtils#getcollectionfromtomanyrelation)
- [getFieldSchema](../wiki/@forestadmin.datasource-toolkit.CollectionUtils#getfieldschema)
- [getInverseRelation](../wiki/@forestadmin.datasource-toolkit.CollectionUtils#getinverserelation)
- [listRelation](../wiki/@forestadmin.datasource-toolkit.CollectionUtils#listrelation)

## Constructors

### constructor

• **new CollectionUtils**()

## Methods

### aggregateRelation

▸ `Static` **aggregateRelation**(`collection`, `id`, `relationName`, `paginatedFilter`, `aggregation`): `Promise`<[`AggregateResult`](../wiki/@forestadmin.datasource-toolkit#aggregateresult)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `collection` | [`Collection`](../wiki/@forestadmin.datasource-toolkit.Collection) |
| `id` | [`CompositeId`](../wiki/@forestadmin.datasource-toolkit#compositeid) |
| `relationName` | `string` |
| `paginatedFilter` | [`PaginatedFilter`](../wiki/@forestadmin.datasource-toolkit.PaginatedFilter) |
| `aggregation` | [`Aggregation`](../wiki/@forestadmin.datasource-toolkit.Aggregation) |

#### Returns

`Promise`<[`AggregateResult`](../wiki/@forestadmin.datasource-toolkit#aggregateresult)[]\>

#### Defined in

[packages/datasource-toolkit/src/utils/collection.ts:113](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/utils/collection.ts#L113)

___

### getCollectionFromToManyRelation

▸ `Static` **getCollectionFromToManyRelation**(`collection`, `relation`): [`Collection`](../wiki/@forestadmin.datasource-toolkit.Collection)

#### Parameters

| Name | Type |
| :------ | :------ |
| `collection` | [`Collection`](../wiki/@forestadmin.datasource-toolkit.Collection) |
| `relation` | [`OneToManySchema`](../wiki/@forestadmin.datasource-toolkit#onetomanyschema) \| [`ManyToManySchema`](../wiki/@forestadmin.datasource-toolkit#manytomanyschema) |

#### Returns

[`Collection`](../wiki/@forestadmin.datasource-toolkit.Collection)

#### Defined in

[packages/datasource-toolkit/src/utils/collection.ts:143](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/utils/collection.ts#L143)

___

### getFieldSchema

▸ `Static` **getFieldSchema**(`collection`, `path`): [`FieldSchema`](../wiki/@forestadmin.datasource-toolkit#fieldschema)

#### Parameters

| Name | Type |
| :------ | :------ |
| `collection` | [`Collection`](../wiki/@forestadmin.datasource-toolkit.Collection) |
| `path` | `string` |

#### Returns

[`FieldSchema`](../wiki/@forestadmin.datasource-toolkit#fieldschema)

#### Defined in

[packages/datasource-toolkit/src/utils/collection.ts:19](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/utils/collection.ts#L19)

___

### getInverseRelation

▸ `Static` **getInverseRelation**(`collection`, `relationName`): `string`

#### Parameters

| Name | Type |
| :------ | :------ |
| `collection` | [`Collection`](../wiki/@forestadmin.datasource-toolkit.Collection) |
| `relationName` | `string` |

#### Returns

`string`

#### Defined in

[packages/datasource-toolkit/src/utils/collection.ts:48](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/utils/collection.ts#L48)

___

### listRelation

▸ `Static` **listRelation**(`collection`, `id`, `relationName`, `paginatedFilter`, `projection`): `Promise`<[`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `collection` | [`Collection`](../wiki/@forestadmin.datasource-toolkit.Collection) |
| `id` | [`CompositeId`](../wiki/@forestadmin.datasource-toolkit#compositeid) |
| `relationName` | `string` |
| `paginatedFilter` | [`PaginatedFilter`](../wiki/@forestadmin.datasource-toolkit.PaginatedFilter) |
| `projection` | [`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection) |

#### Returns

`Promise`<[`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata)[]\>

#### Defined in

[packages/datasource-toolkit/src/utils/collection.ts:80](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/utils/collection.ts#L80)
