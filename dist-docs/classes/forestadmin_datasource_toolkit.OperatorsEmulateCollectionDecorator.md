[root](../README.md) / [Modules](../modules.md) / [@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md) / OperatorsEmulateCollectionDecorator

# Class: OperatorsEmulateCollectionDecorator

[@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md).OperatorsEmulateCollectionDecorator

## Hierarchy

- `default`

  ↳ **`OperatorsEmulateCollectionDecorator`**

## Table of contents

### Constructors

- [constructor](forestadmin_datasource_toolkit.OperatorsEmulateCollectionDecorator.md#constructor)

### Properties

- [childCollection](forestadmin_datasource_toolkit.OperatorsEmulateCollectionDecorator.md#childcollection)
- [dataSource](forestadmin_datasource_toolkit.OperatorsEmulateCollectionDecorator.md#datasource)

### Accessors

- [name](forestadmin_datasource_toolkit.OperatorsEmulateCollectionDecorator.md#name)
- [schema](forestadmin_datasource_toolkit.OperatorsEmulateCollectionDecorator.md#schema)

### Methods

- [aggregate](forestadmin_datasource_toolkit.OperatorsEmulateCollectionDecorator.md#aggregate)
- [create](forestadmin_datasource_toolkit.OperatorsEmulateCollectionDecorator.md#create)
- [delete](forestadmin_datasource_toolkit.OperatorsEmulateCollectionDecorator.md#delete)
- [emulateOperator](forestadmin_datasource_toolkit.OperatorsEmulateCollectionDecorator.md#emulateoperator)
- [execute](forestadmin_datasource_toolkit.OperatorsEmulateCollectionDecorator.md#execute)
- [getForm](forestadmin_datasource_toolkit.OperatorsEmulateCollectionDecorator.md#getform)
- [implementOperator](forestadmin_datasource_toolkit.OperatorsEmulateCollectionDecorator.md#implementoperator)
- [list](forestadmin_datasource_toolkit.OperatorsEmulateCollectionDecorator.md#list)
- [refineFilter](forestadmin_datasource_toolkit.OperatorsEmulateCollectionDecorator.md#refinefilter)
- [refineSchema](forestadmin_datasource_toolkit.OperatorsEmulateCollectionDecorator.md#refineschema)
- [update](forestadmin_datasource_toolkit.OperatorsEmulateCollectionDecorator.md#update)

## Constructors

### constructor

• **new OperatorsEmulateCollectionDecorator**(`childCollection`, `dataSource`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `childCollection` | [`Collection`](../interfaces/forestadmin_datasource_toolkit.Collection.md) |
| `dataSource` | [`DataSource`](../interfaces/forestadmin_datasource_toolkit.DataSource.md) |

#### Inherited from

CollectionDecorator.constructor

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:14](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L14)

## Properties

### childCollection

• `Protected` **childCollection**: [`Collection`](../interfaces/forestadmin_datasource_toolkit.Collection.md)

#### Inherited from

CollectionDecorator.childCollection

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:12](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L12)

___

### dataSource

• `Readonly` **dataSource**: [`DataSourceDecorator`](forestadmin_datasource_toolkit.DataSourceDecorator.md)<[`OperatorsEmulateCollectionDecorator`](forestadmin_datasource_toolkit.OperatorsEmulateCollectionDecorator.md)\>

#### Overrides

CollectionDecorator.dataSource

#### Defined in

[packages/datasource-toolkit/src/decorators/operators-emulate/collection.ts:19](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/operators-emulate/collection.ts#L19)

## Accessors

### name

• `get` **name**(): `string`

#### Returns

`string`

#### Inherited from

CollectionDecorator.name

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:19](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L19)

___

### schema

• `get` **schema**(): [`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema)

#### Returns

[`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema)

#### Inherited from

CollectionDecorator.schema

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:23](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L23)

## Methods

### aggregate

▸ **aggregate**(`filter`, `aggregation`, `limit?`): `Promise`<[`AggregateResult`](../modules/forestadmin_datasource_toolkit.md#aggregateresult)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`Filter`](forestadmin_datasource_toolkit.Filter.md) |
| `aggregation` | [`Aggregation`](forestadmin_datasource_toolkit.Aggregation.md) |
| `limit?` | `number` |

#### Returns

`Promise`<[`AggregateResult`](../modules/forestadmin_datasource_toolkit.md#aggregateresult)[]\>

#### Inherited from

CollectionDecorator.aggregate

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:61](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L61)

___

### create

▸ **create**(`data`): `Promise`<[`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `data` | [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[] |

#### Returns

`Promise`<[`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[]\>

#### Inherited from

CollectionDecorator.create

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:39](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L39)

___

### delete

▸ **delete**(`filter`): `Promise`<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`Filter`](forestadmin_datasource_toolkit.Filter.md) |

#### Returns

`Promise`<`void`\>

#### Inherited from

CollectionDecorator.delete

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:55](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L55)

___

### emulateOperator

▸ **emulateOperator**(`name`, `operator`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `operator` | [`Operator`](../enums/forestadmin_datasource_toolkit.Operator.md) |

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/decorators/operators-emulate/collection.ts:22](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/operators-emulate/collection.ts#L22)

___

### execute

▸ **execute**(`name`, `data`, `filter?`): `Promise`<[`ActionResult`](../modules/forestadmin_datasource_toolkit.md#actionresult)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `data` | [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata) |
| `filter?` | [`Filter`](forestadmin_datasource_toolkit.Filter.md) |

#### Returns

`Promise`<[`ActionResult`](../modules/forestadmin_datasource_toolkit.md#actionresult)\>

#### Inherited from

CollectionDecorator.execute

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:27](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L27)

___

### getForm

▸ **getForm**(`name`, `data?`, `filter?`): `Promise`<[`ActionField`](../interfaces/forestadmin_datasource_toolkit.ActionField.md)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `data?` | [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata) |
| `filter?` | [`Filter`](forestadmin_datasource_toolkit.Filter.md) |

#### Returns

`Promise`<[`ActionField`](../interfaces/forestadmin_datasource_toolkit.ActionField.md)[]\>

#### Inherited from

CollectionDecorator.getForm

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:33](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L33)

___

### implementOperator

▸ **implementOperator**(`name`, `operator`, `replaceBy`): `void`

#### Parameters

| Name | Type |
| :------ | :------ |
| `name` | `string` |
| `operator` | [`Operator`](../enums/forestadmin_datasource_toolkit.Operator.md) |
| `replaceBy` | [`OperatorReplacer`](../modules/forestadmin_datasource_toolkit.md#operatorreplacer) |

#### Returns

`void`

#### Defined in

[packages/datasource-toolkit/src/decorators/operators-emulate/collection.ts:26](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/operators-emulate/collection.ts#L26)

___

### list

▸ **list**(`filter`, `projection`): `Promise`<[`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[]\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`PaginatedFilter`](forestadmin_datasource_toolkit.PaginatedFilter.md) |
| `projection` | [`Projection`](forestadmin_datasource_toolkit.Projection.md) |

#### Returns

`Promise`<[`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[]\>

#### Inherited from

CollectionDecorator.list

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:43](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L43)

___

### refineFilter

▸ `Protected` **refineFilter**(`filter`): `Promise`<[`PaginatedFilter`](forestadmin_datasource_toolkit.PaginatedFilter.md)\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`PaginatedFilter`](forestadmin_datasource_toolkit.PaginatedFilter.md) |

#### Returns

`Promise`<[`PaginatedFilter`](forestadmin_datasource_toolkit.PaginatedFilter.md)\>

#### Overrides

CollectionDecorator.refineFilter

#### Defined in

[packages/datasource-toolkit/src/decorators/operators-emulate/collection.ts:72](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/operators-emulate/collection.ts#L72)

___

### refineSchema

▸ `Protected` **refineSchema**(`childSchema`): [`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema)

#### Parameters

| Name | Type |
| :------ | :------ |
| `childSchema` | [`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema) |

#### Returns

[`CollectionSchema`](../modules/forestadmin_datasource_toolkit.md#collectionschema)

#### Overrides

CollectionDecorator.refineSchema

#### Defined in

[packages/datasource-toolkit/src/decorators/operators-emulate/collection.ts:51](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/operators-emulate/collection.ts#L51)

___

### update

▸ **update**(`filter`, `patch`): `Promise`<`void`\>

#### Parameters

| Name | Type |
| :------ | :------ |
| `filter` | [`Filter`](forestadmin_datasource_toolkit.Filter.md) |
| `patch` | [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata) |

#### Returns

`Promise`<`void`\>

#### Inherited from

CollectionDecorator.update

#### Defined in

[packages/datasource-toolkit/src/decorators/collection-decorator.ts:49](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/datasource-toolkit/src/decorators/collection-decorator.ts#L49)
