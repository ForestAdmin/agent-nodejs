[root](../README.md) / [Modules](../modules.md) / [@forestadmin/datasource-sequelize](../modules/forestadmin_datasource_sequelize.md) / TypeConverter

# Class: TypeConverter

[@forestadmin/datasource-sequelize](../modules/forestadmin_datasource_sequelize.md).TypeConverter

## Table of contents

### Constructors

- [constructor](forestadmin_datasource_sequelize.TypeConverter.md#constructor)

### Methods

- [fromColumnType](forestadmin_datasource_sequelize.TypeConverter.md#fromcolumntype)
- [fromDataType](forestadmin_datasource_sequelize.TypeConverter.md#fromdatatype)
- [operatorsForDataType](forestadmin_datasource_sequelize.TypeConverter.md#operatorsfordatatype)

## Constructors

### constructor

• **new TypeConverter**()

## Methods

### fromColumnType

▸ `Static` **fromColumnType**(`columnType`): `AbstractDataTypeConstructor`

#### Parameters

| Name | Type |
| :------ | :------ |
| `columnType` | `PrimitiveTypes` |

#### Returns

`AbstractDataTypeConstructor`

#### Defined in

[packages/datasource-sequelize/src/utils/type-converter.ts:21](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-sequelize/src/utils/type-converter.ts#L21)

___

### fromDataType

▸ `Static` **fromDataType**(`dataType`): `ColumnType`

#### Parameters

| Name | Type |
| :------ | :------ |
| `dataType` | `AbstractDataTypeConstructor` \| `ArrayDataType`<`AbstractDataTypeConstructor`\> |

#### Returns

`ColumnType`

#### Defined in

[packages/datasource-sequelize/src/utils/type-converter.ts:67](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-sequelize/src/utils/type-converter.ts#L67)

___

### operatorsForDataType

▸ `Static` **operatorsForDataType**(`dataType`): `Set`<`Operator`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `dataType` | `AbstractDataTypeConstructor` \| `ArrayDataType`<`AbstractDataTypeConstructor`\> |

#### Returns

`Set`<`Operator`\>

#### Defined in

[packages/datasource-sequelize/src/utils/type-converter.ts:93](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-sequelize/src/utils/type-converter.ts#L93)
