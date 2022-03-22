# Class: SchemaUtils

[@forestadmin/datasource-toolkit](../wiki/@forestadmin.datasource-toolkit).SchemaUtils

## Table of contents

### Constructors

- [constructor](../wiki/@forestadmin.datasource-toolkit.SchemaUtils#constructor)

### Methods

- [getForeignKeyName](../wiki/@forestadmin.datasource-toolkit.SchemaUtils#getforeignkeyname)
- [getPrimaryKeys](../wiki/@forestadmin.datasource-toolkit.SchemaUtils#getprimarykeys)
- [getToManyRelation](../wiki/@forestadmin.datasource-toolkit.SchemaUtils#gettomanyrelation)
- [isSolelyForeignKey](../wiki/@forestadmin.datasource-toolkit.SchemaUtils#issolelyforeignkey)

## Constructors

### constructor

• **new SchemaUtils**()

## Methods

### getForeignKeyName

▸ `Static` **getForeignKeyName**(`schema`, `relationName`): `string`

#### Parameters

| Name | Type |
| :------ | :------ |
| `schema` | [`CollectionSchema`](../wiki/@forestadmin.datasource-toolkit#collectionschema) |
| `relationName` | `string` |

#### Returns

`string`

#### Defined in

[packages/datasource-toolkit/src/utils/schema.ts:10](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/utils/schema.ts#L10)

___

### getPrimaryKeys

▸ `Static` **getPrimaryKeys**(`schema`): `string`[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `schema` | [`CollectionSchema`](../wiki/@forestadmin.datasource-toolkit#collectionschema) |

#### Returns

`string`[]

#### Defined in

[packages/datasource-toolkit/src/utils/schema.ts:16](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/utils/schema.ts#L16)

___

### getToManyRelation

▸ `Static` **getToManyRelation**(`schema`, `relationName`): [`OneToManySchema`](../wiki/@forestadmin.datasource-toolkit#onetomanyschema) \| [`ManyToManySchema`](../wiki/@forestadmin.datasource-toolkit#manytomanyschema)

#### Parameters

| Name | Type |
| :------ | :------ |
| `schema` | [`CollectionSchema`](../wiki/@forestadmin.datasource-toolkit#collectionschema) |
| `relationName` | `string` |

#### Returns

[`OneToManySchema`](../wiki/@forestadmin.datasource-toolkit#onetomanyschema) \| [`ManyToManySchema`](../wiki/@forestadmin.datasource-toolkit#manytomanyschema)

#### Defined in

[packages/datasource-toolkit/src/utils/schema.ts:36](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/utils/schema.ts#L36)

___

### isSolelyForeignKey

▸ `Static` **isSolelyForeignKey**(`schema`, `name`): `boolean`

#### Parameters

| Name | Type |
| :------ | :------ |
| `schema` | [`CollectionSchema`](../wiki/@forestadmin.datasource-toolkit#collectionschema) |
| `name` | `string` |

#### Returns

`boolean`

#### Defined in

[packages/datasource-toolkit/src/utils/schema.ts:24](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/utils/schema.ts#L24)
