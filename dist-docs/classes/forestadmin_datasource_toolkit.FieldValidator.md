[root](../README.md) / [Modules](../modules.md) / [@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md) / FieldValidator

# Class: FieldValidator

[@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md).FieldValidator

## Table of contents

### Constructors

- [constructor](forestadmin_datasource_toolkit.FieldValidator.md#constructor)

### Methods

- [checkEnumValue](forestadmin_datasource_toolkit.FieldValidator.md#checkenumvalue)
- [validate](forestadmin_datasource_toolkit.FieldValidator.md#validate)
- [validateValue](forestadmin_datasource_toolkit.FieldValidator.md#validatevalue)

## Constructors

### constructor

• **new FieldValidator**()

## Methods

### checkEnumValue

▸ `Static` **checkEnumValue**(`type`, `columnSchema`, `enumValue`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `type` | [`PrimitiveTypes`](../enums/forestadmin_datasource_toolkit.PrimitiveTypes.md) \| `ValidationTypes` |
| `columnSchema` | [`ColumnSchema`](../modules/forestadmin_datasource_toolkit.md#columnschema) |
| `enumValue` | `unknown` |

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/validation/field.ts:77](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/validation/field.ts#L77)

___

### validate

▸ `Static` **validate**(`collection`, `field`, `values?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `collection` | [`Collection`](../interfaces/forestadmin_datasource_toolkit.Collection.md) |
| `field` | `string` |
| `values?` | `unknown`[] |

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/validation/field.ts:8](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/validation/field.ts#L8)

___

### validateValue

▸ `Static` **validateValue**(`field`, `schema`, `value`, `allowedTypes?`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `field` | `string` |
| `schema` | [`ColumnSchema`](../modules/forestadmin_datasource_toolkit.md#columnschema) |
| `value` | `unknown` |
| `allowedTypes?` | readonly ([`PrimitiveTypes`](../enums/forestadmin_datasource_toolkit.PrimitiveTypes.md) \| `ValidationTypes`)[] |

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/validation/field.ts:49](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/validation/field.ts#L49)
