[root](../README.md) / [Modules](../modules.md) / [@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md) / ConditionTreeLeaf

# Class: ConditionTreeLeaf

[@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md).ConditionTreeLeaf

## Hierarchy

- [`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

  ↳ **`ConditionTreeLeaf`**

## Table of contents

### Constructors

- [constructor](forestadmin_datasource_toolkit.ConditionTreeLeaf.md#constructor)

### Properties

- [field](forestadmin_datasource_toolkit.ConditionTreeLeaf.md#field)
- [operator](forestadmin_datasource_toolkit.ConditionTreeLeaf.md#operator)
- [value](forestadmin_datasource_toolkit.ConditionTreeLeaf.md#value)

### Accessors

- [projection](forestadmin_datasource_toolkit.ConditionTreeLeaf.md#projection)

### Methods

- [apply](forestadmin_datasource_toolkit.ConditionTreeLeaf.md#apply)
- [everyLeaf](forestadmin_datasource_toolkit.ConditionTreeLeaf.md#everyleaf)
- [forEachLeaf](forestadmin_datasource_toolkit.ConditionTreeLeaf.md#foreachleaf)
- [inverse](forestadmin_datasource_toolkit.ConditionTreeLeaf.md#inverse)
- [match](forestadmin_datasource_toolkit.ConditionTreeLeaf.md#match)
- [nest](forestadmin_datasource_toolkit.ConditionTreeLeaf.md#nest)
- [override](forestadmin_datasource_toolkit.ConditionTreeLeaf.md#override)
- [replaceFields](forestadmin_datasource_toolkit.ConditionTreeLeaf.md#replacefields)
- [replaceLeafs](forestadmin_datasource_toolkit.ConditionTreeLeaf.md#replaceleafs)
- [replaceLeafsAsync](forestadmin_datasource_toolkit.ConditionTreeLeaf.md#replaceleafsasync)
- [someLeaf](forestadmin_datasource_toolkit.ConditionTreeLeaf.md#someleaf)
- [unnest](forestadmin_datasource_toolkit.ConditionTreeLeaf.md#unnest)
- [useIntervalOperator](forestadmin_datasource_toolkit.ConditionTreeLeaf.md#useintervaloperator)

## Constructors

### constructor

• **new ConditionTreeLeaf**(`field`, `operator`, `value?`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `field` | `string` |
| `operator` | [`Operator`](../enums/forestadmin_datasource_toolkit.Operator.md) |
| `value?` | `unknown` |

#### Overrides

[ConditionTree](forestadmin_datasource_toolkit.ConditionTree.md).[constructor](forestadmin_datasource_toolkit.ConditionTree.md#constructor)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:89](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L89)

## Properties

### field

• **field**: `string`

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:81](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L81)

___

### operator

• **operator**: [`Operator`](../enums/forestadmin_datasource_toolkit.Operator.md)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:82](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L82)

___

### value

• `Optional` **value**: `unknown`

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:83](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L83)

## Accessors

### projection

• `get` **projection**(): [`Projection`](forestadmin_datasource_toolkit.Projection.md)

#### Returns

[`Projection`](forestadmin_datasource_toolkit.Projection.md)

#### Overrides

ConditionTree.projection

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:85](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L85)

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

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:19](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L19)

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

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:100](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L100)

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

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:96](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L96)

___

### inverse

▸ **inverse**(): [`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Returns

[`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Overrides

[ConditionTree](forestadmin_datasource_toolkit.ConditionTree.md).[inverse](forestadmin_datasource_toolkit.ConditionTree.md#inverse)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:108](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L108)

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

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:141](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L141)

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

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:23](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L23)

___

### override

▸ **override**(`params`): [`ConditionTreeLeaf`](forestadmin_datasource_toolkit.ConditionTreeLeaf.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `params` | `Partial`<[`LeafComponents`](../modules/forestadmin_datasource_toolkit.md#leafcomponents)\> |

#### Returns

[`ConditionTreeLeaf`](forestadmin_datasource_toolkit.ConditionTreeLeaf.md)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:175](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L175)

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

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:46](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L46)

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

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:129](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L129)

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

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:135](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L135)

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

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:104](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L104)

___

### unnest

▸ **unnest**(): [`ConditionTreeLeaf`](forestadmin_datasource_toolkit.ConditionTreeLeaf.md)

#### Returns

[`ConditionTreeLeaf`](forestadmin_datasource_toolkit.ConditionTreeLeaf.md)

#### Overrides

[ConditionTree](forestadmin_datasource_toolkit.ConditionTree.md).[unnest](forestadmin_datasource_toolkit.ConditionTree.md#unnest)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:179](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L179)

___

### useIntervalOperator

▸ **useIntervalOperator**(): `boolean`

#### Returns

`boolean`

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:196](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L196)
