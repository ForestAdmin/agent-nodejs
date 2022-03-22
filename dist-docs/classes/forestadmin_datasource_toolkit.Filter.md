[root](../README.md) / [Modules](../modules.md) / [@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md) / Filter

# Class: Filter

[@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md).Filter

## Hierarchy

- **`Filter`**

  ↳ [`PaginatedFilter`](forestadmin_datasource_toolkit.PaginatedFilter.md)

## Table of contents

### Constructors

- [constructor](forestadmin_datasource_toolkit.Filter.md#constructor)

### Properties

- [conditionTree](forestadmin_datasource_toolkit.Filter.md#conditiontree)
- [search](forestadmin_datasource_toolkit.Filter.md#search)
- [searchExtended](forestadmin_datasource_toolkit.Filter.md#searchextended)
- [segment](forestadmin_datasource_toolkit.Filter.md#segment)
- [timezone](forestadmin_datasource_toolkit.Filter.md#timezone)

### Methods

- [override](forestadmin_datasource_toolkit.Filter.md#override)

## Constructors

### constructor

• **new Filter**(`parts`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `parts` | [`FilterComponents`](../modules/forestadmin_datasource_toolkit.md#filtercomponents) |

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts:18](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts#L18)

## Properties

### conditionTree

• `Optional` **conditionTree**: [`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts:12](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts#L12)

___

### search

• `Optional` **search**: `string`

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts:13](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts#L13)

___

### searchExtended

• `Optional` **searchExtended**: `boolean`

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts:14](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts#L14)

___

### segment

• `Optional` **segment**: `string`

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts:15](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts#L15)

___

### timezone

• `Optional` **timezone**: `string`

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts:16](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts#L16)

## Methods

### override

▸ **override**(`fields`): [`Filter`](forestadmin_datasource_toolkit.Filter.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `fields` | [`FilterComponents`](../modules/forestadmin_datasource_toolkit.md#filtercomponents) |

#### Returns

[`Filter`](forestadmin_datasource_toolkit.Filter.md)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts:26](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts#L26)
