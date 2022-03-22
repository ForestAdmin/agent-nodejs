# Class: ConditionTree

[@forestadmin/datasource-toolkit](../wiki/@forestadmin.datasource-toolkit).ConditionTree

## Hierarchy

- **`ConditionTree`**

  ↳ [`ConditionTreeBranch`](../wiki/@forestadmin.datasource-toolkit.ConditionTreeBranch)

  ↳ [`ConditionTreeLeaf`](../wiki/@forestadmin.datasource-toolkit.ConditionTreeLeaf)

  ↳ [`ConditionTreeNot`](../wiki/@forestadmin.datasource-toolkit.ConditionTreeNot)

## Table of contents

### Constructors

- [constructor](../wiki/@forestadmin.datasource-toolkit.ConditionTree#constructor)

### Accessors

- [projection](../wiki/@forestadmin.datasource-toolkit.ConditionTree#projection)

### Methods

- [apply](../wiki/@forestadmin.datasource-toolkit.ConditionTree#apply)
- [everyLeaf](../wiki/@forestadmin.datasource-toolkit.ConditionTree#everyleaf)
- [forEachLeaf](../wiki/@forestadmin.datasource-toolkit.ConditionTree#foreachleaf)
- [inverse](../wiki/@forestadmin.datasource-toolkit.ConditionTree#inverse)
- [match](../wiki/@forestadmin.datasource-toolkit.ConditionTree#match)
- [nest](../wiki/@forestadmin.datasource-toolkit.ConditionTree#nest)
- [replaceFields](../wiki/@forestadmin.datasource-toolkit.ConditionTree#replacefields)
- [replaceLeafs](../wiki/@forestadmin.datasource-toolkit.ConditionTree#replaceleafs)
- [replaceLeafsAsync](../wiki/@forestadmin.datasource-toolkit.ConditionTree#replaceleafsasync)
- [someLeaf](../wiki/@forestadmin.datasource-toolkit.ConditionTree#someleaf)
- [unnest](../wiki/@forestadmin.datasource-toolkit.ConditionTree#unnest)

## Constructors

### constructor

• **new ConditionTree**()

## Accessors

### projection

• `Abstract` `get` **projection**(): [`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection)

#### Returns

[`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:17](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L17)

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

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:19](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L19)

___

### everyLeaf

▸ `Abstract` **everyLeaf**(`handler`): `boolean`

#### Parameters

| Name | Type |
| :------ | :------ |
| `handler` | [`LeafTester`](../wiki/@forestadmin.datasource-toolkit#leaftester) |

#### Returns

`boolean`

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:14](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L14)

___

### forEachLeaf

▸ `Abstract` **forEachLeaf**(`handler`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `handler` | [`LeafCallback`](../wiki/@forestadmin.datasource-toolkit#leafcallback) |

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:13](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L13)

___

### inverse

▸ `Abstract` **inverse**(): [`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Returns

[`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:7](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L7)

___

### match

▸ `Abstract` **match**(`record`, `collection`, `timezone`): `boolean`

#### Parameters

| Name | Type |
| :------ | :------ |
| `record` | [`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata) |
| `collection` | [`Collection`](../wiki/@forestadmin.datasource-toolkit.Collection) |
| `timezone` | `string` |

#### Returns

`boolean`

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:11](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L11)

___

### nest

▸ **nest**(`prefix`): [`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Parameters

| Name | Type |
| :------ | :------ |
| `prefix` | `string` |

#### Returns

[`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

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

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:46](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L46)

___

### replaceLeafs

▸ `Abstract` **replaceLeafs**(`handler`, `bind?`): [`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Parameters

| Name | Type |
| :------ | :------ |
| `handler` | [`LeafReplacer`](../wiki/@forestadmin.datasource-toolkit#leafreplacer) |
| `bind?` | `unknown` |

#### Returns

[`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:8](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L8)

___

### replaceLeafsAsync

▸ `Abstract` **replaceLeafsAsync**(`handler`, `bind?`): `Promise`<[`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `handler` | [`AsyncLeafReplacer`](../wiki/@forestadmin.datasource-toolkit#asyncleafreplacer) |
| `bind?` | `unknown` |

#### Returns

`Promise`<[`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)\>

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:9](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L9)

___

### someLeaf

▸ `Abstract` **someLeaf**(`handler`): `boolean`

#### Parameters

| Name | Type |
| :------ | :------ |
| `handler` | [`LeafTester`](../wiki/@forestadmin.datasource-toolkit#leaftester) |

#### Returns

`boolean`

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:15](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L15)

___

### unnest

▸ **unnest**(): [`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Returns

[`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts:29](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/base.ts#L29)
