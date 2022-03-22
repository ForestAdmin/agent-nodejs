# Class: ConditionTreeFactory

[@forestadmin/datasource-toolkit](../wiki/@forestadmin.datasource-toolkit).ConditionTreeFactory

## Table of contents

### Constructors

- [constructor](../wiki/@forestadmin.datasource-toolkit.ConditionTreeFactory#constructor)

### Properties

- [MatchAll](../wiki/@forestadmin.datasource-toolkit.ConditionTreeFactory#matchall)
- [MatchNone](../wiki/@forestadmin.datasource-toolkit.ConditionTreeFactory#matchnone)

### Methods

- [fromPlainObject](../wiki/@forestadmin.datasource-toolkit.ConditionTreeFactory#fromplainobject)
- [intersect](../wiki/@forestadmin.datasource-toolkit.ConditionTreeFactory#intersect)
- [matchIds](../wiki/@forestadmin.datasource-toolkit.ConditionTreeFactory#matchids)
- [matchRecords](../wiki/@forestadmin.datasource-toolkit.ConditionTreeFactory#matchrecords)
- [union](../wiki/@forestadmin.datasource-toolkit.ConditionTreeFactory#union)

## Constructors

### constructor

• **new ConditionTreeFactory**()

## Properties

### MatchAll

▪ `Static` **MatchAll**: [`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree) = `null`

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/factory.ts:11](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/factory.ts#L11)

___

### MatchNone

▪ `Static` **MatchNone**: [`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/factory.ts:10](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/factory.ts#L10)

## Methods

### fromPlainObject

▸ `Static` **fromPlainObject**(`json`): [`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Parameters

| Name | Type |
| :------ | :------ |
| `json` | `unknown` |

#### Returns

[`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/factory.ts:51](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/factory.ts#L51)

___

### intersect

▸ `Static` **intersect**(...`trees`): [`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Parameters

| Name | Type |
| :------ | :------ |
| `...trees` | [`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)[] |

#### Returns

[`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/factory.ts:41](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/factory.ts#L41)

___

### matchIds

▸ `Static` **matchIds**(`schema`, `ids`): [`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Parameters

| Name | Type |
| :------ | :------ |
| `schema` | [`CollectionSchema`](../wiki/@forestadmin.datasource-toolkit#collectionschema) |
| `ids` | [`CompositeId`](../wiki/@forestadmin.datasource-toolkit#compositeid)[] |

#### Returns

[`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/factory.ts:19](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/factory.ts#L19)

___

### matchRecords

▸ `Static` **matchRecords**(`schema`, `records`): [`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Parameters

| Name | Type |
| :------ | :------ |
| `schema` | [`CollectionSchema`](../wiki/@forestadmin.datasource-toolkit#collectionschema) |
| `records` | [`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata)[] |

#### Returns

[`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/factory.ts:13](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/factory.ts#L13)

___

### union

▸ `Static` **union**(...`trees`): [`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Parameters

| Name | Type |
| :------ | :------ |
| `...trees` | [`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)[] |

#### Returns

[`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/factory.ts:37](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/factory.ts#L37)
