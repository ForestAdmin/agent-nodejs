# Class: TypeConverter

[@forestadmin/datasource-sequelize](../wiki/@forestadmin.datasource-sequelize).TypeConverter

## Table of contents

### Constructors

- [constructor](../wiki/@forestadmin.datasource-sequelize.TypeConverter#constructor)

### Methods

- [fromColumnType](../wiki/@forestadmin.datasource-sequelize.TypeConverter#fromcolumntype)
- [fromDataType](../wiki/@forestadmin.datasource-sequelize.TypeConverter#fromdatatype)
- [operatorsForDataType](../wiki/@forestadmin.datasource-sequelize.TypeConverter#operatorsfordatatype)

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

[packages/datasource-sequelize/src/utils/type-converter.ts:21](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-sequelize/src/utils/type-converter.ts#L21)

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

[packages/datasource-sequelize/src/utils/type-converter.ts:67](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-sequelize/src/utils/type-converter.ts#L67)

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

[packages/datasource-sequelize/src/utils/type-converter.ts:93](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-sequelize/src/utils/type-converter.ts#L93)
