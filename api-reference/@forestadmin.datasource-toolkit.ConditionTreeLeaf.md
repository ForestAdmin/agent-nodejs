# Class: ConditionTreeLeaf

[@forestadmin/datasource-toolkit](../wiki/@forestadmin.datasource-toolkit).ConditionTreeLeaf

## Hierarchy

- [`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

  ↳ **`ConditionTreeLeaf`**

## Table of contents

### Constructors

- [constructor](../wiki/@forestadmin.datasource-toolkit.ConditionTreeLeaf#constructor)

### Properties

- [field](../wiki/@forestadmin.datasource-toolkit.ConditionTreeLeaf#field)
- [operator](../wiki/@forestadmin.datasource-toolkit.ConditionTreeLeaf#operator)
- [value](../wiki/@forestadmin.datasource-toolkit.ConditionTreeLeaf#value)

### Accessors

- [projection](../wiki/@forestadmin.datasource-toolkit.ConditionTreeLeaf#projection)

### Methods

- [apply](../wiki/@forestadmin.datasource-toolkit.ConditionTreeLeaf#apply)
- [everyLeaf](../wiki/@forestadmin.datasource-toolkit.ConditionTreeLeaf#everyleaf)
- [forEachLeaf](../wiki/@forestadmin.datasource-toolkit.ConditionTreeLeaf#foreachleaf)
- [inverse](../wiki/@forestadmin.datasource-toolkit.ConditionTreeLeaf#inverse)
- [match](../wiki/@forestadmin.datasource-toolkit.ConditionTreeLeaf#match)
- [nest](../wiki/@forestadmin.datasource-toolkit.ConditionTreeLeaf#nest)
- [override](../wiki/@forestadmin.datasource-toolkit.ConditionTreeLeaf#override)
- [replaceFields](../wiki/@forestadmin.datasource-toolkit.ConditionTreeLeaf#replacefields)
- [replaceLeafs](../wiki/@forestadmin.datasource-toolkit.ConditionTreeLeaf#replaceleafs)
- [replaceLeafsAsync](../wiki/@forestadmin.datasource-toolkit.ConditionTreeLeaf#replaceleafsasync)
- [someLeaf](../wiki/@forestadmin.datasource-toolkit.ConditionTreeLeaf#someleaf)
- [unnest](../wiki/@forestadmin.datasource-toolkit.ConditionTreeLeaf#unnest)
- [useIntervalOperator](../wiki/@forestadmin.datasource-toolkit.ConditionTreeLeaf#useintervaloperator)

## Constructors

### constructor

• **new ConditionTreeLeaf**(`field`, `operator`, `value?`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `field` | `string` |
| `operator` | [`Operator`](../wiki/@forestadmin.datasource-toolkit.Operator) |
| `value?` | `unknown` |

#### Overrides

[ConditionTree](../wiki/@forestadmin.datasource-toolkit.ConditionTree).[constructor](../wiki/@forestadmin.datasource-toolkit.ConditionTree#constructor)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:89](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L89)

## Properties

### field

• **field**: `string`

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:81](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L81)

___

### operator

• **operator**: [`Operator`](../wiki/@forestadmin.datasource-toolkit.Operator)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:82](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L82)

___

### value

• `Optional` **value**: `unknown`

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:83](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L83)

## Accessors

### projection

• `get` **projection**(): [`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection)

#### Returns

[`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection)

#### Overrides

ConditionTree.projection

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:85](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L85)

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

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:100](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L100)

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

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:96](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L96)

___

### inverse

▸ **inverse**(): [`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Returns

[`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Overrides

[ConditionTree](../wiki/@forestadmin.datasource-toolkit.ConditionTree).[inverse](../wiki/@forestadmin.datasource-toolkit.ConditionTree#inverse)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:108](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L108)

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

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:141](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L141)

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

### override

▸ **override**(`params`): [`ConditionTreeLeaf`](../wiki/@forestadmin.datasource-toolkit.ConditionTreeLeaf)

#### Parameters

| Name | Type |
| :------ | :------ |
| `params` | `Partial`<[`LeafComponents`](../wiki/@forestadmin.datasource-toolkit#leafcomponents)\> |

#### Returns

[`ConditionTreeLeaf`](../wiki/@forestadmin.datasource-toolkit.ConditionTreeLeaf)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:175](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L175)

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

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:129](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L129)

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

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:135](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L135)

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

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:104](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L104)

___

### unnest

▸ **unnest**(): [`ConditionTreeLeaf`](../wiki/@forestadmin.datasource-toolkit.ConditionTreeLeaf)

#### Returns

[`ConditionTreeLeaf`](../wiki/@forestadmin.datasource-toolkit.ConditionTreeLeaf)

#### Overrides

[ConditionTree](../wiki/@forestadmin.datasource-toolkit.ConditionTree).[unnest](../wiki/@forestadmin.datasource-toolkit.ConditionTree#unnest)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:179](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L179)

___

### useIntervalOperator

▸ **useIntervalOperator**(): `boolean`

#### Returns

`boolean`

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:196](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L196)
