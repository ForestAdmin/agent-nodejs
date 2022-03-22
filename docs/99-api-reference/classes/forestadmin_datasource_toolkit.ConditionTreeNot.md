[root](../README.md) / [Modules](../modules.md) / [@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md) / ConditionTreeNot

# Class: ConditionTreeNot

[@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md).ConditionTreeNot

## Hierarchy

- [`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

  ↳ **`ConditionTreeNot`**

## Table of contents

### Constructors

- [constructor](forestadmin_datasource_toolkit.ConditionTreeNot.md#constructor)

### Properties

- [condition](forestadmin_datasource_toolkit.ConditionTreeNot.md#condition)

### Accessors

- [projection](forestadmin_datasource_toolkit.ConditionTreeNot.md#projection)

### Methods

- [apply](forestadmin_datasource_toolkit.ConditionTreeNot.md#apply)
- [everyLeaf](forestadmin_datasource_toolkit.ConditionTreeNot.md#everyleaf)
- [forEachLeaf](forestadmin_datasource_toolkit.ConditionTreeNot.md#foreachleaf)
- [inverse](forestadmin_datasource_toolkit.ConditionTreeNot.md#inverse)
- [match](forestadmin_datasource_toolkit.ConditionTreeNot.md#match)
- [nest](forestadmin_datasource_toolkit.ConditionTreeNot.md#nest)
- [replaceFields](forestadmin_datasource_toolkit.ConditionTreeNot.md#replacefields)
- [replaceLeafs](forestadmin_datasource_toolkit.ConditionTreeNot.md#replaceleafs)
- [replaceLeafsAsync](forestadmin_datasource_toolkit.ConditionTreeNot.md#replaceleafsasync)
- [someLeaf](forestadmin_datasource_toolkit.ConditionTreeNot.md#someleaf)
- [unnest](forestadmin_datasource_toolkit.ConditionTreeNot.md#unnest)

## Constructors

### constructor

• **new ConditionTreeNot**(`condition`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `condition` | [`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md) |

#### Overrides

[ConditionTree](forestadmin_datasource_toolkit.ConditionTree.md).[constructor](forestadmin_datasource_toolkit.ConditionTree.md#constructor)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts:14](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts#L14)

## Properties

### condition

• **condition**: [`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts:8](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts#L8)

## Accessors

### projection

• `get` **projection**(): [`Projection`](forestadmin_datasource_toolkit.Projection.md)

#### Returns

[`Projection`](forestadmin_datasource_toolkit.Projection.md)

#### Overrides

ConditionTree.projection

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts:10](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts#L10)

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

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:19](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L19)

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

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts:23](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts#L23)

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

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts:19](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts#L19)

___

### inverse

▸ **inverse**(): [`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Returns

[`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Overrides

[ConditionTree](forestadmin_datasource_toolkit.ConditionTree.md).[inverse](forestadmin_datasource_toolkit.ConditionTree.md#inverse)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts:31](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts#L31)

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

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts:43](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts#L43)

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

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:23](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L23)

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

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:46](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L46)

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

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts:35](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts#L35)

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

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts:39](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts#L39)

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

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts:27](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts#L27)

___

### unnest

▸ **unnest**(): [`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Returns

[`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Inherited from

[ConditionTree](forestadmin_datasource_toolkit.ConditionTree.md).[unnest](forestadmin_datasource_toolkit.ConditionTree.md#unnest)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:29](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L29)
