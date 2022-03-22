# Class: ConditionTreeBranch

[@forestadmin/datasource-toolkit](../wiki/@forestadmin.datasource-toolkit).ConditionTreeBranch

## Hierarchy

- [`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

  ↳ **`ConditionTreeBranch`**

## Table of contents

### Constructors

- [constructor](../wiki/@forestadmin.datasource-toolkit.ConditionTreeBranch#constructor)

### Properties

- [aggregator](../wiki/@forestadmin.datasource-toolkit.ConditionTreeBranch#aggregator)
- [conditions](../wiki/@forestadmin.datasource-toolkit.ConditionTreeBranch#conditions)

### Accessors

- [projection](../wiki/@forestadmin.datasource-toolkit.ConditionTreeBranch#projection)

### Methods

- [apply](../wiki/@forestadmin.datasource-toolkit.ConditionTreeBranch#apply)
- [everyLeaf](../wiki/@forestadmin.datasource-toolkit.ConditionTreeBranch#everyleaf)
- [forEachLeaf](../wiki/@forestadmin.datasource-toolkit.ConditionTreeBranch#foreachleaf)
- [inverse](../wiki/@forestadmin.datasource-toolkit.ConditionTreeBranch#inverse)
- [match](../wiki/@forestadmin.datasource-toolkit.ConditionTreeBranch#match)
- [nest](../wiki/@forestadmin.datasource-toolkit.ConditionTreeBranch#nest)
- [replaceFields](../wiki/@forestadmin.datasource-toolkit.ConditionTreeBranch#replacefields)
- [replaceLeafs](../wiki/@forestadmin.datasource-toolkit.ConditionTreeBranch#replaceleafs)
- [replaceLeafsAsync](../wiki/@forestadmin.datasource-toolkit.ConditionTreeBranch#replaceleafsasync)
- [someLeaf](../wiki/@forestadmin.datasource-toolkit.ConditionTreeBranch#someleaf)
- [unnest](../wiki/@forestadmin.datasource-toolkit.ConditionTreeBranch#unnest)

## Constructors

### constructor

• **new ConditionTreeBranch**(`aggregator`, `conditions`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `aggregator` | [`Aggregator`](../wiki/@forestadmin.datasource-toolkit.Aggregator) |
| `conditions` | [`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)[] |

#### Overrides

[ConditionTree](../wiki/@forestadmin.datasource-toolkit.ConditionTree).[constructor](../wiki/@forestadmin.datasource-toolkit.ConditionTree#constructor)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts:28](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts#L28)

## Properties

### aggregator

• **aggregator**: [`Aggregator`](../wiki/@forestadmin.datasource-toolkit.Aggregator)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts:18](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts#L18)

___

### conditions

• **conditions**: [`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)[]

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts:19](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts#L19)

## Accessors

### projection

• `get` **projection**(): [`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection)

#### Returns

[`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection)

#### Overrides

ConditionTree.projection

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts:21](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts#L21)

## Methods

### apply

▸ **apply**(`records`, `collection`, `timezone`): [`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata)[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `records` | [`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata)[] |
| `collection` | [`Collection`](../wiki/@forestadmin.datasource-toolkit.Collection) |
| `timezone` | `string` |

#### Returns

[`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata)[]

#### Inherited from

[ConditionTree](../wiki/@forestadmin.datasource-toolkit.ConditionTree).[apply](../wiki/@forestadmin.datasource-toolkit.ConditionTree#apply)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:19](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L19)

___

### everyLeaf

▸ **everyLeaf**(`handler`): `boolean`

#### Parameters

| Name | Type |
| :------ | :------ |
| `handler` | [`LeafTester`](../wiki/@forestadmin.datasource-toolkit#leaftester) |

#### Returns

`boolean`

#### Overrides

[ConditionTree](../wiki/@forestadmin.datasource-toolkit.ConditionTree).[everyLeaf](../wiki/@forestadmin.datasource-toolkit.ConditionTree#everyleaf)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts:38](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts#L38)

___

### forEachLeaf

▸ **forEachLeaf**(`handler`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `handler` | [`LeafCallback`](../wiki/@forestadmin.datasource-toolkit#leafcallback) |

#### Returns

`void`

#### Overrides

[ConditionTree](../wiki/@forestadmin.datasource-toolkit.ConditionTree).[forEachLeaf](../wiki/@forestadmin.datasource-toolkit.ConditionTree#foreachleaf)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts:34](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts#L34)

___

### inverse

▸ **inverse**(): [`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Returns

[`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Overrides

[ConditionTree](../wiki/@forestadmin.datasource-toolkit.ConditionTree).[inverse](../wiki/@forestadmin.datasource-toolkit.ConditionTree#inverse)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts:46](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts#L46)

___

### match

▸ **match**(`record`, `collection`, `timezone`): `boolean`

#### Parameters

| Name | Type |
| :------ | :------ |
| `record` | [`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata) |
| `collection` | [`Collection`](../wiki/@forestadmin.datasource-toolkit.Collection) |
| `timezone` | `string` |

#### Returns

`boolean`

#### Overrides

[ConditionTree](../wiki/@forestadmin.datasource-toolkit.ConditionTree).[match](../wiki/@forestadmin.datasource-toolkit.ConditionTree#match)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts:69](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts#L69)

___

### nest

▸ **nest**(`prefix`): [`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Parameters

| Name | Type |
| :------ | :------ |
| `prefix` | `string` |

#### Returns

[`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Inherited from

[ConditionTree](../wiki/@forestadmin.datasource-toolkit.ConditionTree).[nest](../wiki/@forestadmin.datasource-toolkit.ConditionTree#nest)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:23](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L23)

___

### replaceFields

▸ **replaceFields**(`handler`): [`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Parameters

| Name | Type |
| :------ | :------ |
| `handler` | (`field`: `string`) => `string` |

#### Returns

[`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Inherited from

[ConditionTree](../wiki/@forestadmin.datasource-toolkit.ConditionTree).[replaceFields](../wiki/@forestadmin.datasource-toolkit.ConditionTree#replacefields)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:46](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L46)

___

### replaceLeafs

▸ **replaceLeafs**(`handler`, `bind?`): [`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Parameters

| Name | Type |
| :------ | :------ |
| `handler` | [`LeafReplacer`](../wiki/@forestadmin.datasource-toolkit#leafreplacer) |
| `bind?` | `unknown` |

#### Returns

[`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Overrides

[ConditionTree](../wiki/@forestadmin.datasource-toolkit.ConditionTree).[replaceLeafs](../wiki/@forestadmin.datasource-toolkit.ConditionTree#replaceleafs)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts:55](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts#L55)

___

### replaceLeafsAsync

▸ **replaceLeafsAsync**(`handler`, `bind?`): `Promise`<[`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `handler` | [`AsyncLeafReplacer`](../wiki/@forestadmin.datasource-toolkit#asyncleafreplacer) |
| `bind?` | `unknown` |

#### Returns

`Promise`<[`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)\>

#### Overrides

[ConditionTree](../wiki/@forestadmin.datasource-toolkit.ConditionTree).[replaceLeafsAsync](../wiki/@forestadmin.datasource-toolkit.ConditionTree#replaceleafsasync)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts:62](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts#L62)

___

### someLeaf

▸ **someLeaf**(`handler`): `boolean`

#### Parameters

| Name | Type |
| :------ | :------ |
| `handler` | [`LeafTester`](../wiki/@forestadmin.datasource-toolkit#leaftester) |

#### Returns

`boolean`

#### Overrides

[ConditionTree](../wiki/@forestadmin.datasource-toolkit.ConditionTree).[someLeaf](../wiki/@forestadmin.datasource-toolkit.ConditionTree#someleaf)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts:42](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts#L42)

___

### unnest

▸ **unnest**(): [`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Returns

[`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Inherited from

[ConditionTree](../wiki/@forestadmin.datasource-toolkit.ConditionTree).[unnest](../wiki/@forestadmin.datasource-toolkit.ConditionTree#unnest)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:29](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L29)
