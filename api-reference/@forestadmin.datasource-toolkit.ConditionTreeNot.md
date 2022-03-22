# Class: ConditionTreeNot

[@forestadmin/datasource-toolkit](../wiki/@forestadmin.datasource-toolkit).ConditionTreeNot

## Hierarchy

- [`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

  ↳ **`ConditionTreeNot`**

## Table of contents

### Constructors

- [constructor](../wiki/@forestadmin.datasource-toolkit.ConditionTreeNot#constructor)

### Properties

- [condition](../wiki/@forestadmin.datasource-toolkit.ConditionTreeNot#condition)

### Accessors

- [projection](../wiki/@forestadmin.datasource-toolkit.ConditionTreeNot#projection)

### Methods

- [apply](../wiki/@forestadmin.datasource-toolkit.ConditionTreeNot#apply)
- [everyLeaf](../wiki/@forestadmin.datasource-toolkit.ConditionTreeNot#everyleaf)
- [forEachLeaf](../wiki/@forestadmin.datasource-toolkit.ConditionTreeNot#foreachleaf)
- [inverse](../wiki/@forestadmin.datasource-toolkit.ConditionTreeNot#inverse)
- [match](../wiki/@forestadmin.datasource-toolkit.ConditionTreeNot#match)
- [nest](../wiki/@forestadmin.datasource-toolkit.ConditionTreeNot#nest)
- [replaceFields](../wiki/@forestadmin.datasource-toolkit.ConditionTreeNot#replacefields)
- [replaceLeafs](../wiki/@forestadmin.datasource-toolkit.ConditionTreeNot#replaceleafs)
- [replaceLeafsAsync](../wiki/@forestadmin.datasource-toolkit.ConditionTreeNot#replaceleafsasync)
- [someLeaf](../wiki/@forestadmin.datasource-toolkit.ConditionTreeNot#someleaf)
- [unnest](../wiki/@forestadmin.datasource-toolkit.ConditionTreeNot#unnest)

## Constructors

### constructor

• **new ConditionTreeNot**(`condition`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `condition` | [`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree) |

#### Overrides

[ConditionTree](../wiki/@forestadmin.datasource-toolkit.ConditionTree).[constructor](../wiki/@forestadmin.datasource-toolkit.ConditionTree#constructor)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts:14](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts#L14)

## Properties

### condition

• **condition**: [`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts:8](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts#L8)

## Accessors

### projection

• `get` **projection**(): [`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection)

#### Returns

[`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection)

#### Overrides

ConditionTree.projection

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts:10](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts#L10)

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

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts:23](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts#L23)

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

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts:19](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts#L19)

___

### inverse

▸ **inverse**(): [`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Returns

[`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Overrides

[ConditionTree](../wiki/@forestadmin.datasource-toolkit.ConditionTree).[inverse](../wiki/@forestadmin.datasource-toolkit.ConditionTree#inverse)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts:31](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts#L31)

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

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts:43](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts#L43)

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

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts:35](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts#L35)

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

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts:39](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts#L39)

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

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts:27](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/not.ts#L27)

___

### unnest

▸ **unnest**(): [`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Returns

[`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Inherited from

[ConditionTree](../wiki/@forestadmin.datasource-toolkit.ConditionTree).[unnest](../wiki/@forestadmin.datasource-toolkit.ConditionTree#unnest)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:29](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L29)
