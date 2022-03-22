# Class: RecordUtils

[@forestadmin/datasource-toolkit](../wiki/@forestadmin.datasource-toolkit).RecordUtils

## Table of contents

### Constructors

- [constructor](../wiki/@forestadmin.datasource-toolkit.RecordUtils#constructor)

### Methods

- [getFieldValue](../wiki/@forestadmin.datasource-toolkit.RecordUtils#getfieldvalue)
- [getPrimaryKey](../wiki/@forestadmin.datasource-toolkit.RecordUtils#getprimarykey)

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
| `record` | [`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata) |
| `field` | `string` |

#### Returns

`unknown`

#### Defined in

[packages/datasource-toolkit/src/utils/record.ts:17](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/utils/record.ts#L17)

___

### getPrimaryKey

▸ `Static` **getPrimaryKey**(`schema`, `record`): [`CompositeId`](../wiki/@forestadmin.datasource-toolkit#compositeid)

#### Parameters

| Name | Type |
| :------ | :------ |
| `schema` | [`CollectionSchema`](../wiki/@forestadmin.datasource-toolkit#collectionschema) |
| `record` | [`RecordData`](../wiki/@forestadmin.datasource-toolkit#recorddata) |

#### Returns

[`CompositeId`](../wiki/@forestadmin.datasource-toolkit#compositeid)

#### Defined in

[packages/datasource-toolkit/src/utils/record.ts:6](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/utils/record.ts#L6)
