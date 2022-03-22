# Class: PaginatedFilter

[@forestadmin/datasource-toolkit](../wiki/@forestadmin.datasource-toolkit).PaginatedFilter

## Hierarchy

- [`Filter`](../wiki/@forestadmin.datasource-toolkit.Filter)

  ↳ **`PaginatedFilter`**

## Table of contents

### Constructors

- [constructor](../wiki/@forestadmin.datasource-toolkit.PaginatedFilter#constructor)

### Properties

- [conditionTree](../wiki/@forestadmin.datasource-toolkit.PaginatedFilter#conditiontree)
- [page](../wiki/@forestadmin.datasource-toolkit.PaginatedFilter#page)
- [search](../wiki/@forestadmin.datasource-toolkit.PaginatedFilter#search)
- [searchExtended](../wiki/@forestadmin.datasource-toolkit.PaginatedFilter#searchextended)
- [segment](../wiki/@forestadmin.datasource-toolkit.PaginatedFilter#segment)
- [sort](../wiki/@forestadmin.datasource-toolkit.PaginatedFilter#sort)
- [timezone](../wiki/@forestadmin.datasource-toolkit.PaginatedFilter#timezone)

### Methods

- [override](../wiki/@forestadmin.datasource-toolkit.PaginatedFilter#override)

## Constructors

### constructor

• **new PaginatedFilter**(`parts`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `parts` | [`PaginatedFilterComponents`](../wiki/@forestadmin.datasource-toolkit#paginatedfiltercomponents) |

#### Overrides

[Filter](../wiki/@forestadmin.datasource-toolkit.Filter).[constructor](../wiki/@forestadmin.datasource-toolkit.Filter#constructor)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/paginated.ts:14](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/filter/paginated.ts#L14)

## Properties

### conditionTree

• `Optional` **conditionTree**: [`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)

#### Inherited from

[Filter](../wiki/@forestadmin.datasource-toolkit.Filter).[conditionTree](../wiki/@forestadmin.datasource-toolkit.Filter#conditiontree)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts:12](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts#L12)

___

### page

• `Optional` **page**: [`Page`](../wiki/@forestadmin.datasource-toolkit.Page)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/paginated.ts:12](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/filter/paginated.ts#L12)

___

### search

• `Optional` **search**: `string`

#### Inherited from

[Filter](../wiki/@forestadmin.datasource-toolkit.Filter).[search](../wiki/@forestadmin.datasource-toolkit.Filter#search)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts:13](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts#L13)

___

### searchExtended

• `Optional` **searchExtended**: `boolean`

#### Inherited from

[Filter](../wiki/@forestadmin.datasource-toolkit.Filter).[searchExtended](../wiki/@forestadmin.datasource-toolkit.Filter#searchextended)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts:14](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts#L14)

___

### segment

• `Optional` **segment**: `string`

#### Inherited from

[Filter](../wiki/@forestadmin.datasource-toolkit.Filter).[segment](../wiki/@forestadmin.datasource-toolkit.Filter#segment)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts:15](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts#L15)

___

### sort

• `Optional` **sort**: [`Sort`](../wiki/@forestadmin.datasource-toolkit.Sort)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/paginated.ts:11](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/filter/paginated.ts#L11)

___

### timezone

• `Optional` **timezone**: `string`

#### Inherited from

[Filter](../wiki/@forestadmin.datasource-toolkit.Filter).[timezone](../wiki/@forestadmin.datasource-toolkit.Filter#timezone)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts:16](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts#L16)

## Methods

### override

▸ **override**(`fields`): [`PaginatedFilter`](../wiki/@forestadmin.datasource-toolkit.PaginatedFilter)

#### Parameters

| Name | Type |
| :------ | :------ |
| `fields` | [`PaginatedFilterComponents`](../wiki/@forestadmin.datasource-toolkit#paginatedfiltercomponents) |

#### Returns

[`PaginatedFilter`](../wiki/@forestadmin.datasource-toolkit.PaginatedFilter)

#### Overrides

[Filter](../wiki/@forestadmin.datasource-toolkit.Filter).[override](../wiki/@forestadmin.datasource-toolkit.Filter#override)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/paginated.ts:20](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/filter/paginated.ts#L20)
