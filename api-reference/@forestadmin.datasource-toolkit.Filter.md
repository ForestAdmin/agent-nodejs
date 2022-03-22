# Class: Filter

[@forestadmin/datasource-toolkit](../wiki/@forestadmin.datasource-toolkit).Filter

## Hierarchy

- **`Filter`**

  ↳ [`PaginatedFilter`](../wiki/@forestadmin.datasource-toolkit.PaginatedFilter)

## Table of contents

### Constructors

- [constructor](../wiki/@forestadmin.datasource-toolkit.Filter#constructor)

### Properties

- [conditionTree](../wiki/@forestadmin.datasource-toolkit.Filter#conditiontree)
- [search](../wiki/@forestadmin.datasource-toolkit.Filter#search)
- [searchExtended](../wiki/@forestadmin.datasource-toolkit.Filter#searchextended)
- [segment](../wiki/@forestadmin.datasource-toolkit.Filter#segment)
- [timezone](../wiki/@forestadmin.datasource-toolkit.Filter#timezone)

### Methods

- [override](../wiki/@forestadmin.datasource-toolkit.Filter#override)

## Constructors

### constructor

• **new Filter**(`parts`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `parts` | [`FilterComponents`](../wiki/@forestadmin.datasource-toolkit#filtercomponents) |

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts:18](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts#L18)

## Properties

### conditionTree

• `Optional` **conditionTree**: [`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts:12](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts#L12)

___

### search

• `Optional` **search**: `string`

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts:13](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts#L13)

___

### searchExtended

• `Optional` **searchExtended**: `boolean`

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts:14](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts#L14)

___

### segment

• `Optional` **segment**: `string`

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts:15](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts#L15)

___

### timezone

• `Optional` **timezone**: `string`

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts:16](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts#L16)

## Methods

### override

▸ **override**(`fields`): [`Filter`](../wiki/@forestadmin.datasource-toolkit.Filter)

#### Parameters

| Name | Type |
| :------ | :------ |
| `fields` | [`FilterComponents`](../wiki/@forestadmin.datasource-toolkit#filtercomponents) |

#### Returns

[`Filter`](../wiki/@forestadmin.datasource-toolkit.Filter)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts:26](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts#L26)
