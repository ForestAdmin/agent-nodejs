[root](../README.md) / [Modules](../modules.md) / [@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md) / Aggregation

# Class: Aggregation

[@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md).Aggregation

## Implements

- `AggregationComponents`

## Table of contents

### Constructors

- [constructor](forestadmin_datasource_toolkit.Aggregation.md#constructor)

### Properties

- [field](forestadmin_datasource_toolkit.Aggregation.md#field)
- [groups](forestadmin_datasource_toolkit.Aggregation.md#groups)
- [operation](forestadmin_datasource_toolkit.Aggregation.md#operation)

### Accessors

- [projection](forestadmin_datasource_toolkit.Aggregation.md#projection)

### Methods

- [apply](forestadmin_datasource_toolkit.Aggregation.md#apply)
- [nest](forestadmin_datasource_toolkit.Aggregation.md#nest)
- [replaceFields](forestadmin_datasource_toolkit.Aggregation.md#replacefields)

## Constructors

### constructor

• **new Aggregation**(`components`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `components` | `AggregationComponents` |

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/aggregation.ts:60](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/aggregation.ts#L60)

## Properties

### field

• `Optional` **field**: `string`

#### Implementation of

AggregationComponents.field

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/aggregation.ts:49](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/aggregation.ts#L49)

___

### groups

• `Optional` **groups**: [`AggregationGroup`](../interfaces/forestadmin_datasource_toolkit.AggregationGroup.md)[]

#### Implementation of

AggregationComponents.groups

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/aggregation.ts:51](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/aggregation.ts#L51)

___

### operation

• **operation**: [`AggregationOperation`](../enums/forestadmin_datasource_toolkit.AggregationOperation.md)

#### Implementation of

AggregationComponents.operation

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/aggregation.ts:50](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/aggregation.ts#L50)

## Accessors

### projection

• `get` **projection**(): [`Projection`](forestadmin_datasource_toolkit.Projection.md)

#### Returns

[`Projection`](forestadmin_datasource_toolkit.Projection.md)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/aggregation.ts:53](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/aggregation.ts#L53)

## Methods

### apply

▸ **apply**(`records`, `timezone`): [`AggregateResult`](../modules/forestadmin_datasource_toolkit.md#aggregateresult)[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `records` | [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[] |
| `timezone` | `string` |

#### Returns

[`AggregateResult`](../modules/forestadmin_datasource_toolkit.md#aggregateresult)[]

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/aggregation.ts:66](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/aggregation.ts#L66)

___

### nest

▸ **nest**(`prefix`): [`Aggregation`](forestadmin_datasource_toolkit.Aggregation.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `prefix` | `string` |

#### Returns

[`Aggregation`](forestadmin_datasource_toolkit.Aggregation.md)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/aggregation.ts:70](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/aggregation.ts#L70)

___

### replaceFields

▸ **replaceFields**(`handler`): [`Aggregation`](forestadmin_datasource_toolkit.Aggregation.md)

#### Parameters

| Name | Type |
| :------ | :------ |
| `handler` | (`field`: `string`) => `string` |

#### Returns

[`Aggregation`](forestadmin_datasource_toolkit.Aggregation.md)

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/aggregation.ts:91](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/aggregation.ts#L91)
