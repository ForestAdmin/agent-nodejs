[root](../README.md) / [Modules](../modules.md) / [@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md) / PaginatedFilter

# Class: PaginatedFilter

[@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md).PaginatedFilter

## Hierarchy

- [`Filter`](forestadmin_datasource_toolkit.Filter.md)

  ↳ **`PaginatedFilter`**

## Table of contents

### Constructors

- [constructor](forestadmin_datasource_toolkit.PaginatedFilter.md#constructor)

### Properties

- [conditionTree](forestadmin_datasource_toolkit.PaginatedFilter.md#conditiontree)
- [page](forestadmin_datasource_toolkit.PaginatedFilter.md#page)
- [search](forestadmin_datasource_toolkit.PaginatedFilter.md#search)
- [searchExtended](forestadmin_datasource_toolkit.PaginatedFilter.md#searchextended)
- [segment](forestadmin_datasource_toolkit.PaginatedFilter.md#segment)
- [sort](forestadmin_datasource_toolkit.PaginatedFilter.md#sort)
- [timezone](forestadmin_datasource_toolkit.PaginatedFilter.md#timezone)

### Methods

- [override](forestadmin_datasource_toolkit.PaginatedFilter.md#override)

## Constructors

### constructor

• **new PaginatedFilter**(`parts`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `parts` | [`PaginatedFilterComponents`](../modules/forestadmin_datasource_toolkit.md#paginatedfiltercomponents) |

#### Overrides

[Filter](forestadmin_datasource_toolkit.Filter.md).[constructor](forestadmin_datasource_toolkit.Filter.md#constructor)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/paginated.ts:14](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/filter/paginated.ts#L14)

## Properties

### conditionTree

• `Optional` **conditionTree**: [`ConditionTree`](forestadmin_datasource_toolkit.ConditionTree.md)

#### Inherited from

[Filter](forestadmin_datasource_toolkit.Filter.md).[conditionTree](forestadmin_datasource_toolkit.Filter.md#conditiontree)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts:12](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts#L12)

___

### page

• `Optional` **page**: [`Page`](forestadmin_datasource_toolkit.Page.md)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/paginated.ts:12](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/filter/paginated.ts#L12)

___

### search

• `Optional` **search**: `string`

#### Inherited from

[Filter](forestadmin_datasource_toolkit.Filter.md).[search](forestadmin_datasource_toolkit.Filter.md#search)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts:13](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts#L13)

___

### searchExtended

• `Optional` **searchExtended**: `boolean`

#### Inherited from

[Filter](forestadmin_datasource_toolkit.Filter.md).[searchExtended](forestadmin_datasource_toolkit.Filter.md#searchextended)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts:14](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts#L14)

___

### segment

• `Optional` **segment**: `string`

#### Inherited from

[Filter](forestadmin_datasource_toolkit.Filter.md).[segment](forestadmin_datasource_toolkit.Filter.md#segment)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts:15](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts#L15)

___

### sort

• `Optional` **sort**: [`Sort`](forestadmin_datasource_toolkit.Sort.md)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/paginated.ts:11](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/filter/paginated.ts#L11)

___

### timezone

• `Optional` **timezone**: `string`

#### Inherited from

[Filter](forestadmin_datasource_toolkit.Filter.md).[timezone](forestadmin_datasource_toolkit.Filter.md#timezone)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts:16](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts#L16)

## Methods

### override

▸ **override**(`fields`): [`PaginatedFilter`](forestadmin_datasource_toolkit.PaginatedFilter.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `fields` | [`PaginatedFilterComponents`](../modules/forestadmin_datasource_toolkit.md#paginatedfiltercomponents) |

#### Returns

[`PaginatedFilter`](forestadmin_datasource_toolkit.PaginatedFilter.md)

#### Overrides

[Filter](forestadmin_datasource_toolkit.Filter.md).[override](forestadmin_datasource_toolkit.Filter.md#override)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/paginated.ts:20](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/filter/paginated.ts#L20)
