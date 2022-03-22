[root](../README.md) / [Modules](../modules.md) / [@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md) / ConditionTreeFactory

# Class: ConditionTreeFactory

[@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md).ConditionTreeFactory

## Table of contents

### Constructors

- [constructor](forestadmin_datasource_toolkit.ConditionTreeFactory.md#constructor)

### Properties

- [MatchAll](forestadmin_datasource_toolkit.ConditionTreeFactory.md#matchall)
- [MatchNone](forestadmin_datasource_toolkit.ConditionTreeFactory.md#matchnone)

### Methods

- [fromPlainObject](forestadmin_datasource_toolkit.ConditionTreeFactory.md#fromplainobject)
- [intersect](forestadmin_datasource_toolkit.ConditionTreeFactory.md#intersect)
- [matchIds](forestadmin_datasource_toolkit.ConditionTreeFactory.md#matchids)
- [matchRecords](forestadmin_datasource_toolkit.ConditionTreeFactory.md#matchrecords)
- [union](forestadmin_datasource_toolkit.ConditionTreeFactory.md#union)

## Constructors

### constructor

• **new ConditionTreeFactory**()

## Properties

### MatchAll

▪ `Static` **MatchAll**: [`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md) = `null`

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/factory.ts:11](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/interfaces/query/condition-tree/factory.ts#L11)

___

### MatchNone

▪ `Static` **MatchNone**: [`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/factory.ts:10](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/interfaces/query/condition-tree/factory.ts#L10)

## Methods

### fromPlainObject

▸ `Static` **fromPlainObject**(`json`): [`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `json` | `unknown` |

#### Returns

[`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/factory.ts:51](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/interfaces/query/condition-tree/factory.ts#L51)

___

### intersect

▸ `Static` **intersect**(...`trees`): [`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `...trees` | [`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)[] |

#### Returns

[`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/factory.ts:41](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/interfaces/query/condition-tree/factory.ts#L41)

___

### matchIds

▸ `Static` **matchIds**(`schema`, `ids`): [`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `schema` | [`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema) |
| `ids` | [`CompositeId`](../modules/forestadmin_datasource_toolkit.md#compositeid)[] |

#### Returns

[`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/factory.ts:19](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/interfaces/query/condition-tree/factory.ts#L19)

___

### matchRecords

▸ `Static` **matchRecords**(`schema`, `records`): [`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `schema` | [`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema) |
| `records` | [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[] |

#### Returns

[`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/factory.ts:13](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/interfaces/query/condition-tree/factory.ts#L13)

___

### union

▸ `Static` **union**(...`trees`): [`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `...trees` | [`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)[] |

#### Returns

[`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/factory.ts:37](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/interfaces/query/condition-tree/factory.ts#L37)
