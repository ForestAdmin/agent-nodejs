# Class: Aggregation

[@forestadmin/datasource-toolkit](../wiki/@forestadmin.datasource-toolkit).Aggregation

## Implements

- `AggregationComponents`

## Table of contents

### Constructors

- [constructor](../wiki/@forestadmin.datasource-toolkit.Aggregation#constructor)

### Properties

- [field](../wiki/@forestadmin.datasource-toolkit.Aggregation#field)
- [groups](../wiki/@forestadmin.datasource-toolkit.Aggregation#groups)
- [operation](../wiki/@forestadmin.datasource-toolkit.Aggregation#operation)

### Accessors

- [projection](../wiki/@forestadmin.datasource-toolkit.Aggregation#projection)

### Methods

- [apply](../wiki/@forestadmin.datasource-toolkit.Aggregation#apply)
- [nest](../wiki/@forestadmin.datasource-toolkit.Aggregation#nest)
- [replaceFields](../wiki/@forestadmin.datasource-toolkit.Aggregation#replacefields)

## Constructors

### constructor

• **new Aggregation**(`components`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `components` | `AggregationComponents` |

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/aggregation.ts:60](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/aggregation.ts#L60)

## Properties

### field

• `Optional` **field**: `string`

#### Implementation of

AggregationComponents.field

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/aggregation.ts:49](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/aggregation.ts#L49)

___

### groups

• `Optional` **groups**: [`AggregationGroup`](../wiki/@forestadmin.datasource-toolkit.AggregationGroup)[]

#### Implementation of

AggregationComponents.groups

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/aggregation.ts:51](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/aggregation.ts#L51)

___

### operation

• **operation**: [`AggregationOperation`](../wiki/@forestadmin.datasource-toolkit.AggregationOperation)

#### Implementation of

AggregationComponents.operation

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/aggregation.ts:50](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/aggregation.ts#L50)

## Accessors

### projection

• `get` **projection**(): [`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection)

#### Returns

[`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/aggregation.ts:53](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/aggregation.ts#L53)

## Methods

### apply

▸ **apply**(`records`, `timezone`): [`AggregateResult`](../wiki/@forestadmin.datasource-toolkit#aggregateresult)[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `records` | [`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata)[] |
| `timezone` | `string` |

#### Returns

[`AggregateResult`](../wiki/@forestadmin.datasource-toolkit#aggregateresult)[]

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/aggregation.ts:66](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/aggregation.ts#L66)

___

### nest

▸ **nest**(`prefix`): [`Aggregation`](../wiki/@forestadmin.datasource-toolkit.Aggregation)

#### Parameters

| Name | Type |
| :------ | :------ |
| `prefix` | `string` |

#### Returns

[`Aggregation`](../wiki/@forestadmin.datasource-toolkit.Aggregation)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/aggregation.ts:70](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/aggregation.ts#L70)

___

### replaceFields

▸ **replaceFields**(`handler`): [`Aggregation`](../wiki/@forestadmin.datasource-toolkit.Aggregation)

#### Parameters

| Name | Type |
| :------ | :------ |
| `handler` | (`field`: `string`) => `string` |

#### Returns

[`Aggregation`](../wiki/@forestadmin.datasource-toolkit.Aggregation)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/aggregation.ts:91](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/aggregation.ts#L91)
