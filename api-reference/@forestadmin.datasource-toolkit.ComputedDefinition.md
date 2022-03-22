# Interface: ComputedDefinition

[@forestadmin/datasource-toolkit](../wiki/@forestadmin.datasource-toolkit).ComputedDefinition

## Table of contents

### Properties

- [columnType](../wiki/@forestadmin.datasource-toolkit.ComputedDefinition#columntype)
- [defaultValue](../wiki/@forestadmin.datasource-toolkit.ComputedDefinition#defaultvalue)
- [dependencies](../wiki/@forestadmin.datasource-toolkit.ComputedDefinition#dependencies)
- [enumValues](../wiki/@forestadmin.datasource-toolkit.ComputedDefinition#enumvalues)
- [isRequired](../wiki/@forestadmin.datasource-toolkit.ComputedDefinition#isrequired)

### Methods

- [getValues](../wiki/@forestadmin.datasource-toolkit.ComputedDefinition#getvalues)

## Properties

### columnType

• `Readonly` **columnType**: [`ColumnType`](../wiki/@forestadmin.datasource-toolkit#columntype)

#### Defined in

[packages/datasource-toolkit/src/decorators/computed/types.ts:11](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/computed/types.ts#L11)

___

### defaultValue

• `Optional` `Readonly` **defaultValue**: `unknown`

#### Defined in

[packages/datasource-toolkit/src/decorators/computed/types.ts:14](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/computed/types.ts#L14)

___

### dependencies

• `Readonly` **dependencies**: [`Projection`](../wiki/@forestadmin.datasource-toolkit.Projection)

#### Defined in

[packages/datasource-toolkit/src/decorators/computed/types.ts:12](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/computed/types.ts#L12)

___

### enumValues

• `Optional` `Readonly` **enumValues**: `string`[]

#### Defined in

[packages/datasource-toolkit/src/decorators/computed/types.ts:15](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/computed/types.ts#L15)

___

### isRequired

• `Optional` `Readonly` **isRequired**: `boolean`

#### Defined in

[packages/datasource-toolkit/src/decorators/computed/types.ts:13](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/computed/types.ts#L13)

## Methods

### getValues

▸ **getValues**(`records`, `context`): `unknown`[] \| `Promise`<`unknown`[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `records` | [`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata)[] |
| `context` | [`ComputedContext`](../wiki/@forestadmin.datasource-toolkit#computedcontext) |

#### Returns

`unknown`[] \| `Promise`<`unknown`[]\>

#### Defined in

[packages/datasource-toolkit/src/decorators/computed/types.ts:17](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/computed/types.ts#L17)
