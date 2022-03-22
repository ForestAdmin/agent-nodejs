[root](../README.md) / [Modules](../modules.md) / [@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md) / ConditionTree

# Class: ConditionTree

[@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md).ConditionTree

## Hierarchy

- **`ConditionTree`**

  ↳ [`ConditionTreeBranch`](forestadmin_datasource_toolkit.ConditionTreeBranch.md)

  ↳ [`ConditionTreeLeaf`](forestadmin_datasource_toolkit.ConditionTreeLeaf.md)

  ↳ [`ConditionTreeNot`](forestadmin_datasource_toolkit.ConditionTreeNot.md)

## Table of contents

### Constructors

- [constructor](forestadmin_datasource_toolkit.ConditionTree.md#constructor)

### Accessors

- [projection](forestadmin_datasource_toolkit.ConditionTree.md#projection)

### Methods

- [apply](forestadmin_datasource_toolkit.ConditionTree.md#apply)
- [everyLeaf](forestadmin_datasource_toolkit.ConditionTree.md#everyleaf)
- [forEachLeaf](forestadmin_datasource_toolkit.ConditionTree.md#foreachleaf)
- [inverse](forestadmin_datasource_toolkit.ConditionTree.md#inverse)
- [match](forestadmin_datasource_toolkit.ConditionTree.md#match)
- [nest](forestadmin_datasource_toolkit.ConditionTree.md#nest)
- [replaceFields](forestadmin_datasource_toolkit.ConditionTree.md#replacefields)
- [replaceLeafs](forestadmin_datasource_toolkit.ConditionTree.md#replaceleafs)
- [replaceLeafsAsync](forestadmin_datasource_toolkit.ConditionTree.md#replaceleafsasync)
- [someLeaf](forestadmin_datasource_toolkit.ConditionTree.md#someleaf)
- [unnest](forestadmin_datasource_toolkit.ConditionTree.md#unnest)

## Constructors

### constructor

• **new ConditionTree**()

## Accessors

### projection

• `Abstract` `get` **projection**(): [`Projection`](forestadmin_datasource_toolkit.Projection.md)

#### Returns

[`Projection`](forestadmin_datasource_toolkit.Projection.md)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:17](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L17)

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

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:19](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L19)

___

### everyLeaf

▸ `Abstract` **everyLeaf**(`handler`): `boolean`

#### Parameters

| Name | Type |
| :------ | :------ |
| `handler` | [`LeafTester`](../modules/forestadmin_datasource_toolkit.md#leaftester) |

#### Returns

`boolean`

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:14](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L14)

___

### forEachLeaf

▸ `Abstract` **forEachLeaf**(`handler`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `handler` | [`LeafCallback`](../modules/forestadmin_datasource_toolkit.md#leafcallback) |

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:13](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L13)

___

### inverse

▸ `Abstract` **inverse**(): [`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Returns

[`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:7](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L7)

___

### match

▸ `Abstract` **match**(`record`, `collection`, `timezone`): `boolean`

#### Parameters

| Name | Type |
| :------ | :------ |
| `record` | [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata) |
| `collection` | [`Collection`](../interfaces/forestadmin_datasource_toolkit.Collection.md) |
| `timezone` | `string` |

#### Returns

`boolean`

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:11](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L11)

___

### nest

▸ **nest**(`prefix`): [`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `prefix` | `string` |

#### Returns

[`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:23](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L23)

___

### replaceFields

▸ **replaceFields**(`handler`): [`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `handler` | (`field`: `string`) => `string` |

#### Returns

[`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:46](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L46)

___

### replaceLeafs

▸ `Abstract` **replaceLeafs**(`handler`, `bind?`): [`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `handler` | [`LeafReplacer`](../modules/forestadmin_datasource_toolkit.md#leafreplacer) |
| `bind?` | `unknown` |

#### Returns

[`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:8](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L8)

___

### replaceLeafsAsync

▸ `Abstract` **replaceLeafsAsync**(`handler`, `bind?`): `Promise`<[`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `handler` | [`AsyncLeafReplacer`](../modules/forestadmin_datasource_toolkit.md#asyncleafreplacer) |
| `bind?` | `unknown` |

#### Returns

`Promise`<[`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)\>

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:9](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L9)

___

### someLeaf

▸ `Abstract` **someLeaf**(`handler`): `boolean`

#### Parameters

| Name | Type |
| :------ | :------ |
| `handler` | [`LeafTester`](../modules/forestadmin_datasource_toolkit.md#leaftester) |

#### Returns

`boolean`

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:15](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L15)

___

### unnest

▸ **unnest**(): [`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Returns

[`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:29](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L29)
