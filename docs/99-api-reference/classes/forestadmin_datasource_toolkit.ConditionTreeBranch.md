[root](../README.md) / [Modules](../modules.md) / [@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md) / ConditionTreeBranch

# Class: ConditionTreeBranch

[@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md).ConditionTreeBranch

## Hierarchy

- [`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

  ↳ **`ConditionTreeBranch`**

## Table of contents

### Constructors

- [constructor](forestadmin_datasource_toolkit.ConditionTreeBranch.md#constructor)

### Properties

- [aggregator](forestadmin_datasource_toolkit.ConditionTreeBranch.md#aggregator)
- [conditions](forestadmin_datasource_toolkit.ConditionTreeBranch.md#conditions)

### Accessors

- [projection](forestadmin_datasource_toolkit.ConditionTreeBranch.md#projection)

### Methods

- [apply](forestadmin_datasource_toolkit.ConditionTreeBranch.md#apply)
- [everyLeaf](forestadmin_datasource_toolkit.ConditionTreeBranch.md#everyleaf)
- [forEachLeaf](forestadmin_datasource_toolkit.ConditionTreeBranch.md#foreachleaf)
- [inverse](forestadmin_datasource_toolkit.ConditionTreeBranch.md#inverse)
- [match](forestadmin_datasource_toolkit.ConditionTreeBranch.md#match)
- [nest](forestadmin_datasource_toolkit.ConditionTreeBranch.md#nest)
- [replaceFields](forestadmin_datasource_toolkit.ConditionTreeBranch.md#replacefields)
- [replaceLeafs](forestadmin_datasource_toolkit.ConditionTreeBranch.md#replaceleafs)
- [replaceLeafsAsync](forestadmin_datasource_toolkit.ConditionTreeBranch.md#replaceleafsasync)
- [someLeaf](forestadmin_datasource_toolkit.ConditionTreeBranch.md#someleaf)
- [unnest](forestadmin_datasource_toolkit.ConditionTreeBranch.md#unnest)

## Constructors

### constructor

• **new ConditionTreeBranch**(`aggregator`, `conditions`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `aggregator` | [`Aggregator`](../enums/forestadmin_datasource_toolkit.Aggregator.md) |
| `conditions` | [`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)[] |

#### Overrides

[ConditionTree](forestadmin_datasource_toolkit.ConditionTree.md).[constructor](forestadmin_datasource_toolkit.ConditionTree.md#constructor)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts:28](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts#L28)

## Properties

### aggregator

• **aggregator**: [`Aggregator`](../enums/forestadmin_datasource_toolkit.Aggregator.md)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts:18](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts#L18)

___

### conditions

• **conditions**: [`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)[]

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts:19](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts#L19)

## Accessors

### projection

• `get` **projection**(): [`Projection`](forestadmin_datasource_toolkit.Projection.md)

#### Returns

[`Projection`](forestadmin_datasource_toolkit.Projection.md)

#### Overrides

ConditionTree.projection

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts:21](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts#L21)

## Methods

### apply

▸ **apply**(`records`, `collection`, `timezone`): [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `records` | [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[] |
| `collection` | [`Collection`](../interfaces/forestadmin_datasource_toolkit.Collection.md) |
| `timezone` | `string` |

#### Returns

[`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[]

#### Inherited from

[ConditionTree](forestadmin_datasource_toolkit.ConditionTree.md).[apply](forestadmin_datasource_toolkit.ConditionTree.md#apply)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:19](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L19)

___

### everyLeaf

▸ **everyLeaf**(`handler`): `boolean`

#### Parameters

| Name | Type |
| :------ | :------ |
| `handler` | [`LeafTester`](../modules/forestadmin_datasource_toolkit.md#leaftester) |

#### Returns

`boolean`

#### Overrides

[ConditionTree](forestadmin_datasource_toolkit.ConditionTree.md).[everyLeaf](forestadmin_datasource_toolkit.ConditionTree.md#everyleaf)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts:38](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts#L38)

___

### forEachLeaf

▸ **forEachLeaf**(`handler`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `handler` | [`LeafCallback`](../modules/forestadmin_datasource_toolkit.md#leafcallback) |

#### Returns

`void`

#### Overrides

[ConditionTree](forestadmin_datasource_toolkit.ConditionTree.md).[forEachLeaf](forestadmin_datasource_toolkit.ConditionTree.md#foreachleaf)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts:34](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts#L34)

___

### inverse

▸ **inverse**(): [`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Returns

[`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Overrides

[ConditionTree](forestadmin_datasource_toolkit.ConditionTree.md).[inverse](forestadmin_datasource_toolkit.ConditionTree.md#inverse)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts:46](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts#L46)

___

### match

▸ **match**(`record`, `collection`, `timezone`): `boolean`

#### Parameters

| Name | Type |
| :------ | :------ |
| `record` | [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata) |
| `collection` | [`Collection`](../interfaces/forestadmin_datasource_toolkit.Collection.md) |
| `timezone` | `string` |

#### Returns

`boolean`

#### Overrides

[ConditionTree](forestadmin_datasource_toolkit.ConditionTree.md).[match](forestadmin_datasource_toolkit.ConditionTree.md#match)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts:69](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts#L69)

___

### nest

▸ **nest**(`prefix`): [`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `prefix` | `string` |

#### Returns

[`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Inherited from

[ConditionTree](forestadmin_datasource_toolkit.ConditionTree.md).[nest](forestadmin_datasource_toolkit.ConditionTree.md#nest)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:23](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L23)

___

### replaceFields

▸ **replaceFields**(`handler`): [`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `handler` | (`field`: `string`) => `string` |

#### Returns

[`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Inherited from

[ConditionTree](forestadmin_datasource_toolkit.ConditionTree.md).[replaceFields](forestadmin_datasource_toolkit.ConditionTree.md#replacefields)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:46](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L46)

___

### replaceLeafs

▸ **replaceLeafs**(`handler`, `bind?`): [`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `handler` | [`LeafReplacer`](../modules/forestadmin_datasource_toolkit.md#leafreplacer) |
| `bind?` | `unknown` |

#### Returns

[`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Overrides

[ConditionTree](forestadmin_datasource_toolkit.ConditionTree.md).[replaceLeafs](forestadmin_datasource_toolkit.ConditionTree.md#replaceleafs)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts:55](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts#L55)

___

### replaceLeafsAsync

▸ **replaceLeafsAsync**(`handler`, `bind?`): `Promise`<[`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `handler` | [`AsyncLeafReplacer`](../modules/forestadmin_datasource_toolkit.md#asyncleafreplacer) |
| `bind?` | `unknown` |

#### Returns

`Promise`<[`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)\>

#### Overrides

[ConditionTree](forestadmin_datasource_toolkit.ConditionTree.md).[replaceLeafsAsync](forestadmin_datasource_toolkit.ConditionTree.md#replaceleafsasync)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts:62](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts#L62)

___

### someLeaf

▸ **someLeaf**(`handler`): `boolean`

#### Parameters

| Name | Type |
| :------ | :------ |
| `handler` | [`LeafTester`](../modules/forestadmin_datasource_toolkit.md#leaftester) |

#### Returns

`boolean`

#### Overrides

[ConditionTree](forestadmin_datasource_toolkit.ConditionTree.md).[someLeaf](forestadmin_datasource_toolkit.ConditionTree.md#someleaf)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts:42](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts#L42)

___

### unnest

▸ **unnest**(): [`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Returns

[`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Inherited from

[ConditionTree](forestadmin_datasource_toolkit.ConditionTree.md).[unnest](forestadmin_datasource_toolkit.ConditionTree.md#unnest)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:29](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L29)
