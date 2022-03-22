[root](../README.md) / [Modules](../modules.md) / [@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md) / SchemaUtils

# Class: SchemaUtils

[@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md).SchemaUtils

## Table of contents

### Constructors

- [constructor](forestadmin_datasource_toolkit.SchemaUtils.md#constructor)

### Methods

- [getForeignKeyName](forestadmin_datasource_toolkit.SchemaUtils.md#getforeignkeyname)
- [getPrimaryKeys](forestadmin_datasource_toolkit.SchemaUtils.md#getprimarykeys)
- [getToManyRelation](forestadmin_datasource_toolkit.SchemaUtils.md#gettomanyrelation)
- [isSolelyForeignKey](forestadmin_datasource_toolkit.SchemaUtils.md#issolelyforeignkey)

## Constructors

### constructor

• **new SchemaUtils**()

## Methods

### getForeignKeyName

▸ `Static` **getForeignKeyName**(`schema`, `relationName`): `string`

#### Parameters

| Name | Type |
| :------ | :------ |
| `schema` | [`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema) |
| `relationName` | `string` |

#### Returns

`string`

#### Defined in

[packages/datasource-toolkit/src/utils/schema.ts:10](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/utils/schema.ts#L10)

___

### getPrimaryKeys

▸ `Static` **getPrimaryKeys**(`schema`): `string`[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `schema` | [`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema) |

#### Returns

`string`[]

#### Defined in

[packages/datasource-toolkit/src/utils/schema.ts:16](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/utils/schema.ts#L16)

___

### getToManyRelation

▸ `Static` **getToManyRelation**(`schema`, `relationName`): [`OneToManySchema`](../modules/forestadmin_datasource_toolkit.md#onetomanyschema) \| [`ManyToManySchema`](../modules/forestadmin_datasource_toolkit.md#manytomanyschema)

#### Parameters

| Name | Type |
| :------ | :------ |
| `schema` | [`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema) |
| `relationName` | `string` |

#### Returns

[`OneToManySchema`](../modules/forestadmin_datasource_toolkit.md#onetomanyschema) \| [`ManyToManySchema`](../modules/forestadmin_datasource_toolkit.md#manytomanyschema)

#### Defined in

[packages/datasource-toolkit/src/utils/schema.ts:36](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/utils/schema.ts#L36)

___

### isSolelyForeignKey

▸ `Static` **isSolelyForeignKey**(`schema`, `name`): `boolean`

#### Parameters

| Name | Type |
| :------ | :------ |
| `schema` | [`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema) |
| `name` | `string` |

#### Returns

`boolean`

#### Defined in

[packages/datasource-toolkit/src/utils/schema.ts:24](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/utils/schema.ts#L24)
