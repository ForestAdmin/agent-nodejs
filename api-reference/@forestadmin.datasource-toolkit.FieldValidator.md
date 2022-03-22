# Class: FieldValidator

[@forestadmin/datasource-toolkit](../wiki/@forestadmin.datasource-toolkit).FieldValidator

## Table of contents

### Constructors

- [constructor](../wiki/@forestadmin.datasource-toolkit.FieldValidator#constructor)

### Methods

- [checkEnumValue](../wiki/@forestadmin.datasource-toolkit.FieldValidator#checkenumvalue)
- [validate](../wiki/@forestadmin.datasource-toolkit.FieldValidator#validate)
- [validateValue](../wiki/@forestadmin.datasource-toolkit.FieldValidator#validatevalue)

## Constructors

### constructor

• **new FieldValidator**()

## Methods

### checkEnumValue

▸ `Static` **checkEnumValue**(`type`, `columnSchema`, `enumValue`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `type` | [`PrimitiveTypes`](../wiki/@forestadmin.datasource-toolkit.PrimitiveTypes) \| `ValidationTypes` |
| `columnSchema` | [`ColumnSchema`](../wiki/@forestadmin.datasource-toolkit#columnschema) |
| `enumValue` | `unknown` |

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/validation/field.ts:77](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/validation/field.ts#L77)

___

### validate

▸ `Static` **validate**(`collection`, `field`, `values?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `collection` | [`Collection`](../wiki/@forestadmin.datasource-toolkit.Collection) |
| `field` | `string` |
| `values?` | `unknown`[] |

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/validation/field.ts:8](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/validation/field.ts#L8)

___

### validateValue

▸ `Static` **validateValue**(`field`, `schema`, `value`, `allowedTypes?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `field` | `string` |
| `schema` | [`ColumnSchema`](../wiki/@forestadmin.datasource-toolkit#columnschema) |
| `value` | `unknown` |
| `allowedTypes?` | readonly ([`PrimitiveTypes`](../wiki/@forestadmin.datasource-toolkit.PrimitiveTypes) \| `ValidationTypes`)[] |

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/validation/field.ts:49](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/validation/field.ts#L49)
