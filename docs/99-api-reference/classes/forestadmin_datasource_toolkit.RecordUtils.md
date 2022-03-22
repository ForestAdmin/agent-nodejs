[root](../README.md) / [Modules](../modules.md) / [@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md) / RecordUtils

# Class: RecordUtils

[@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md).RecordUtils

## Table of contents

### Constructors

- [constructor](forestadmin_datasource_toolkit.RecordUtils.md#constructor)

### Methods

- [getFieldValue](forestadmin_datasource_toolkit.RecordUtils.md#getfieldvalue)
- [getPrimaryKey](forestadmin_datasource_toolkit.RecordUtils.md#getprimarykey)

## Constructors

### constructor

• **new RecordUtils**()

## Methods

### getFieldValue

▸ `Static` **getFieldValue**(`record`, `field`): `unknown`

Get value of field from record

#### Parameters

| Name | Type |
| :------ | :------ |
| `record` | [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata) |
| `field` | `string` |

#### Returns

`unknown`

#### Defined in

[packages/datasource-toolkit/src/utils/record.ts:17](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/utils/record.ts#L17)

___

### getPrimaryKey

▸ `Static` **getPrimaryKey**(`schema`, `record`): [`CompositeId`](../modules/forestadmin_datasource_toolkit.md#compositeid)

#### Parameters

| Name | Type |
| :------ | :------ |
| `schema` | [`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema) |
| `record` | [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata) |

#### Returns

[`CompositeId`](../modules/forestadmin_datasource_toolkit.md#compositeid)

#### Defined in

[packages/datasource-toolkit/src/utils/record.ts:6](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/utils/record.ts#L6)
