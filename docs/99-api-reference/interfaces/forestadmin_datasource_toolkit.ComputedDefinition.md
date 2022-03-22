[root](../README.md) / [Modules](../modules.md) / [@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md) / ComputedDefinition

# Interface: ComputedDefinition

[@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md).ComputedDefinition

## Table of contents

### Properties

- [columnType](forestadmin_datasource_toolkit.ComputedDefinition.md#columntype)
- [defaultValue](forestadmin_datasource_toolkit.ComputedDefinition.md#defaultvalue)
- [dependencies](forestadmin_datasource_toolkit.ComputedDefinition.md#dependencies)
- [enumValues](forestadmin_datasource_toolkit.ComputedDefinition.md#enumvalues)
- [isRequired](forestadmin_datasource_toolkit.ComputedDefinition.md#isrequired)

### Methods

- [getValues](forestadmin_datasource_toolkit.ComputedDefinition.md#getvalues)

## Properties

### columnType

• `Readonly` **columnType**: [`ColumnType`](../modules/forestadmin_datasource_toolkit.md#columntype)

#### Defined in

[packages/datasource-toolkit/src/decorators/computed/types.ts:11](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/decorators/computed/types.ts#L11)

___

### defaultValue

• `Optional` `Readonly` **defaultValue**: `unknown`

#### Defined in

[packages/datasource-toolkit/src/decorators/computed/types.ts:14](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/decorators/computed/types.ts#L14)

___

### dependencies

• `Readonly` **dependencies**: [`Projection`](../classes/forestadmin_datasource_toolkit.Projection.md)

#### Defined in

[packages/datasource-toolkit/src/decorators/computed/types.ts:12](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/decorators/computed/types.ts#L12)

___

### enumValues

• `Optional` `Readonly` **enumValues**: `string`[]

#### Defined in

[packages/datasource-toolkit/src/decorators/computed/types.ts:15](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/decorators/computed/types.ts#L15)

___

### isRequired

• `Optional` `Readonly` **isRequired**: `boolean`

#### Defined in

[packages/datasource-toolkit/src/decorators/computed/types.ts:13](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/decorators/computed/types.ts#L13)

## Methods

### getValues

▸ **getValues**(`records`, `context`): `unknown`[] \| `Promise`<`unknown`[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `records` | [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[] |
| `context` | [`ComputedContext`](../modules/forestadmin_datasource_toolkit.md#computedcontext) |

#### Returns

`unknown`[] \| `Promise`<`unknown`[]\>

#### Defined in

[packages/datasource-toolkit/src/decorators/computed/types.ts:17](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/decorators/computed/types.ts#L17)
