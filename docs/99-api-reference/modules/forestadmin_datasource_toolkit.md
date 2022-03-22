[root](../README.md) / [Modules](../modules.md) / @forestadmin/datasource-toolkit

# Module: @forestadmin/datasource-toolkit

## Table of contents

### Enumerations

- [ActionFieldType](../enums/forestadmin_datasource_toolkit.ActionFieldType.md)
- [ActionResultType](../enums/forestadmin_datasource_toolkit.ActionResultType.md)
- [ActionScope](../enums/forestadmin_datasource_toolkit.ActionScope.md)
- [AggregationOperation](../enums/forestadmin_datasource_toolkit.AggregationOperation.md)
- [Aggregator](../enums/forestadmin_datasource_toolkit.Aggregator.md)
- [DateOperation](../enums/forestadmin_datasource_toolkit.DateOperation.md)
- [FieldTypes](../enums/forestadmin_datasource_toolkit.FieldTypes.md)
- [Operator](../enums/forestadmin_datasource_toolkit.Operator.md)
- [PrimitiveTypes](../enums/forestadmin_datasource_toolkit.PrimitiveTypes.md)

### Classes

- [ActionCollectionDecorator](../classes/forestadmin_datasource_toolkit.ActionCollectionDecorator.md)
- [Aggregation](../classes/forestadmin_datasource_toolkit.Aggregation.md)
- [BaseCollection](../classes/forestadmin_datasource_toolkit.BaseCollection.md)
- [BaseDataSource](../classes/forestadmin_datasource_toolkit.BaseDataSource.md)
- [CollectionUtils](../classes/forestadmin_datasource_toolkit.CollectionUtils.md)
- [ComputedCollectionDecorator](../classes/forestadmin_datasource_toolkit.ComputedCollectionDecorator.md)
- [ConditionTree](../classes/forestadmin_datasource_toolkit.ConditionTree.md)
- [ConditionTreeBranch](../classes/forestadmin_datasource_toolkit.ConditionTreeBranch.md)
- [ConditionTreeFactory](../classes/forestadmin_datasource_toolkit.ConditionTreeFactory.md)
- [ConditionTreeLeaf](../classes/forestadmin_datasource_toolkit.ConditionTreeLeaf.md)
- [ConditionTreeNot](../classes/forestadmin_datasource_toolkit.ConditionTreeNot.md)
- [ConditionTreeValidator](../classes/forestadmin_datasource_toolkit.ConditionTreeValidator.md)
- [DataSourceDecorator](../classes/forestadmin_datasource_toolkit.DataSourceDecorator.md)
- [FieldValidator](../classes/forestadmin_datasource_toolkit.FieldValidator.md)
- [Filter](../classes/forestadmin_datasource_toolkit.Filter.md)
- [FilterFactory](../classes/forestadmin_datasource_toolkit.FilterFactory.md)
- [JointureCollectionDecorator](../classes/forestadmin_datasource_toolkit.JointureCollectionDecorator.md)
- [OperatorsEmulateCollectionDecorator](../classes/forestadmin_datasource_toolkit.OperatorsEmulateCollectionDecorator.md)
- [OperatorsReplaceCollectionDecorator](../classes/forestadmin_datasource_toolkit.OperatorsReplaceCollectionDecorator.md)
- [Page](../classes/forestadmin_datasource_toolkit.Page.md)
- [PaginatedFilter](../classes/forestadmin_datasource_toolkit.PaginatedFilter.md)
- [Projection](../classes/forestadmin_datasource_toolkit.Projection.md)
- [ProjectionValidator](../classes/forestadmin_datasource_toolkit.ProjectionValidator.md)
- [PublicationCollectionDecorator](../classes/forestadmin_datasource_toolkit.PublicationCollectionDecorator.md)
- [RecordUtils](../classes/forestadmin_datasource_toolkit.RecordUtils.md)
- [RecordValidator](../classes/forestadmin_datasource_toolkit.RecordValidator.md)
- [RenameCollectionDecorator](../classes/forestadmin_datasource_toolkit.RenameCollectionDecorator.md)
- [SchemaUtils](../classes/forestadmin_datasource_toolkit.SchemaUtils.md)
- [SearchCollectionDecorator](../classes/forestadmin_datasource_toolkit.SearchCollectionDecorator.md)
- [SegmentCollectionDecorator](../classes/forestadmin_datasource_toolkit.SegmentCollectionDecorator.md)
- [Sort](../classes/forestadmin_datasource_toolkit.Sort.md)
- [SortEmulateCollectionDecorator](../classes/forestadmin_datasource_toolkit.SortEmulateCollectionDecorator.md)
- [SortFactory](../classes/forestadmin_datasource_toolkit.SortFactory.md)
- [SortValidator](../classes/forestadmin_datasource_toolkit.SortValidator.md)
- [ValidationError](../classes/forestadmin_datasource_toolkit.ValidationError.md)

### Interfaces

- [ActionField](../interfaces/forestadmin_datasource_toolkit.ActionField.md)
- [AggregationGroup](../interfaces/forestadmin_datasource_toolkit.AggregationGroup.md)
- [Collection](../interfaces/forestadmin_datasource_toolkit.Collection.md)
- [ComputedDefinition](../interfaces/forestadmin_datasource_toolkit.ComputedDefinition.md)
- [DataSource](../interfaces/forestadmin_datasource_toolkit.DataSource.md)
- [ProxyDefinition](../interfaces/forestadmin_datasource_toolkit.ProxyDefinition.md)

### Type aliases

- [ActionDefinition](forestadmin_datasource_toolkit.md#actiondefinition)
- [ActionResult](forestadmin_datasource_toolkit.md#actionresult)
- [ActionSchema](forestadmin_datasource_toolkit.md#actionschema)
- [AggregateResult](forestadmin_datasource_toolkit.md#aggregateresult)
- [AsyncLeafReplacer](forestadmin_datasource_toolkit.md#asyncleafreplacer)
- [BranchComponents](forestadmin_datasource_toolkit.md#branchcomponents)
- [CollectionSchema](forestadmin_datasource_toolkit.md#collectionschema)
- [ColumnSchema](forestadmin_datasource_toolkit.md#columnschema)
- [ColumnType](forestadmin_datasource_toolkit.md#columntype)
- [CompositeId](forestadmin_datasource_toolkit.md#compositeid)
- [ComputedContext](forestadmin_datasource_toolkit.md#computedcontext)
- [DataSourceSchema](forestadmin_datasource_toolkit.md#datasourceschema)
- [ErrorResult](forestadmin_datasource_toolkit.md#errorresult)
- [FieldSchema](forestadmin_datasource_toolkit.md#fieldschema)
- [File](forestadmin_datasource_toolkit.md#file)
- [FileResult](forestadmin_datasource_toolkit.md#fileresult)
- [FilterComponents](forestadmin_datasource_toolkit.md#filtercomponents)
- [Json](forestadmin_datasource_toolkit.md#json)
- [LeafCallback](forestadmin_datasource_toolkit.md#leafcallback)
- [LeafComponents](forestadmin_datasource_toolkit.md#leafcomponents)
- [LeafReplacer](forestadmin_datasource_toolkit.md#leafreplacer)
- [LeafTester](forestadmin_datasource_toolkit.md#leaftester)
- [ManyToManySchema](forestadmin_datasource_toolkit.md#manytomanyschema)
- [ManyToOneSchema](forestadmin_datasource_toolkit.md#manytooneschema)
- [OneToManySchema](forestadmin_datasource_toolkit.md#onetomanyschema)
- [OneToOneSchema](forestadmin_datasource_toolkit.md#onetooneschema)
- [OperatorReplacer](forestadmin_datasource_toolkit.md#operatorreplacer)
- [PaginatedFilterComponents](forestadmin_datasource_toolkit.md#paginatedfiltercomponents)
- [RecordData](forestadmin_datasource_toolkit.md#recorddata)
- [RedirectResult](forestadmin_datasource_toolkit.md#redirectresult)
- [RelationSchema](forestadmin_datasource_toolkit.md#relationschema)
- [SortClause](forestadmin_datasource_toolkit.md#sortclause)
- [SuccessResult](forestadmin_datasource_toolkit.md#successresult)
- [WebHookResult](forestadmin_datasource_toolkit.md#webhookresult)

## Type aliases

### ActionDefinition

Ƭ **ActionDefinition**: `ActionSingle` \| `ActionBulk` \| `ActionGlobal`

#### Defined in

[packages/datasource-toolkit/src/decorators/actions/types/actions.ts:22](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/decorators/actions/types/actions.ts#L22)

___

### ActionResult

Ƭ **ActionResult**: [`SuccessResult`](forestadmin_datasource_toolkit.md#successresult) \| [`ErrorResult`](forestadmin_datasource_toolkit.md#errorresult) \| [`WebHookResult`](forestadmin_datasource_toolkit.md#webhookresult) \| [`FileResult`](forestadmin_datasource_toolkit.md#fileresult) \| [`RedirectResult`](forestadmin_datasource_toolkit.md#redirectresult)

#### Defined in

[packages/datasource-toolkit/src/interfaces/action.ts:80](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/action.ts#L80)

___

### ActionSchema

Ƭ **ActionSchema**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `generateFile?` | `boolean` |
| `scope` | [`ActionScope`](../enums/forestadmin_datasource_toolkit.ActionScope.md) |
| `staticForm?` | `boolean` |

#### Defined in

[packages/datasource-toolkit/src/interfaces/schema.ts:9](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/schema.ts#L9)

___

### AggregateResult

Ƭ **AggregateResult**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `group` | { `[field: string]`: `unknown`;  } |
| `value` | `unknown` |

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/aggregation.ts:23](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/aggregation.ts#L23)

___

### AsyncLeafReplacer

Ƭ **AsyncLeafReplacer**: `LeafHandler`<`Promise`<[`ConditionTree`](../classes/forestadmin_datasource_toolkit.ConditionTree.md) \| [`LeafComponents`](forestadmin_datasource_toolkit.md#leafcomponents)\>\>

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:75](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L75)

___

### BranchComponents

Ƭ **BranchComponents**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `aggregator` | [`Aggregator`](../enums/forestadmin_datasource_toolkit.Aggregator.md) |
| `conditions` | ([`BranchComponents`](forestadmin_datasource_toolkit.md#branchcomponents) \| [`LeafComponents`](forestadmin_datasource_toolkit.md#leafcomponents))[] |

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts:12](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts#L12)

___

### CollectionSchema

Ƭ **CollectionSchema**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `actions` | { `[actionName: string]`: [`ActionSchema`](forestadmin_datasource_toolkit.md#actionschema);  } |
| `fields` | { `[fieldName: string]`: [`FieldSchema`](forestadmin_datasource_toolkit.md#fieldschema);  } |
| `searchable` | `boolean` |
| `segments` | `string`[] |

#### Defined in

[packages/datasource-toolkit/src/interfaces/schema.ts:15](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/schema.ts#L15)

___

### ColumnSchema

Ƭ **ColumnSchema**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `columnType` | [`ColumnType`](forestadmin_datasource_toolkit.md#columntype) |
| `defaultValue?` | `unknown` |
| `enumValues?` | `string`[] |
| `filterOperators?` | `Set`<[`Operator`](../enums/forestadmin_datasource_toolkit.Operator.md)\> |
| `isPrimaryKey?` | `boolean` |
| `isReadOnly?` | `boolean` |
| `isSortable?` | `boolean` |
| `type` | [`Column`](../enums/forestadmin_datasource_toolkit.FieldTypes.md#column) |
| `validation?` | { `operator`: [`Operator`](../enums/forestadmin_datasource_toolkit.Operator.md) ; `value?`: `unknown`  }[] |

#### Defined in

[packages/datasource-toolkit/src/interfaces/schema.ts:29](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/schema.ts#L29)

___

### ColumnType

Ƭ **ColumnType**: [`PrimitiveTypes`](../enums/forestadmin_datasource_toolkit.PrimitiveTypes.md) \| { `[key: string]`: [`ColumnType`](forestadmin_datasource_toolkit.md#columntype);  } \| [[`ColumnType`](forestadmin_datasource_toolkit.md#columntype)]

#### Defined in

[packages/datasource-toolkit/src/interfaces/schema.ts:69](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/schema.ts#L69)

___

### CompositeId

Ƭ **CompositeId**: (`number` \| `string`)[]

#### Defined in

[packages/datasource-toolkit/src/interfaces/record.ts:1](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/record.ts#L1)

___

### ComputedContext

Ƭ **ComputedContext**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `dataSource` | [`DataSource`](../interfaces/forestadmin_datasource_toolkit.DataSource.md) |

#### Defined in

[packages/datasource-toolkit/src/decorators/computed/types.ts:6](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/decorators/computed/types.ts#L6)

___

### DataSourceSchema

Ƭ **DataSourceSchema**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `collections` | { `[name: string]`: [`CollectionSchema`](forestadmin_datasource_toolkit.md#collectionschema);  } |

#### Defined in

[packages/datasource-toolkit/src/interfaces/schema.ts:22](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/schema.ts#L22)

___

### ErrorResult

Ƭ **ErrorResult**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `message` | `string` |
| `type` | [`Error`](../enums/forestadmin_datasource_toolkit.ActionResultType.md#error) |

#### Defined in

[packages/datasource-toolkit/src/interfaces/action.ts:55](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/action.ts#L55)

___

### FieldSchema

Ƭ **FieldSchema**: [`ColumnSchema`](forestadmin_datasource_toolkit.md#columnschema) \| [`RelationSchema`](forestadmin_datasource_toolkit.md#relationschema)

#### Defined in

[packages/datasource-toolkit/src/interfaces/schema.ts:27](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/schema.ts#L27)

___

### File

Ƭ **File**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `buffer` | `Buffer` |
| `charset?` | `string` |
| `mimeType` | `string` |
| `name` | `string` |

#### Defined in

[packages/datasource-toolkit/src/interfaces/action.ts:5](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/action.ts#L5)

___

### FileResult

Ƭ **FileResult**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `mimeType` | `string` |
| `name` | `string` |
| `stream` | `Readable` |
| `type` | [`File`](../enums/forestadmin_datasource_toolkit.ActionResultType.md#file) |

#### Defined in

[packages/datasource-toolkit/src/interfaces/action.ts:68](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/action.ts#L68)

___

### FilterComponents

Ƭ **FilterComponents**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `conditionTree?` | [`ConditionTree`](../classes/forestadmin_datasource_toolkit.ConditionTree.md) |
| `search?` | `string` |
| `searchExtended?` | `boolean` |
| `segment?` | `string` |
| `timezone?` | `string` |

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts:3](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts#L3)

___

### Json

Ƭ **Json**: `string` \| `number` \| `boolean` \| { `[x: string]`: [`Json`](forestadmin_datasource_toolkit.md#json);  } \| [`Json`](forestadmin_datasource_toolkit.md#json)[]

#### Defined in

[packages/datasource-toolkit/src/interfaces/action.ts:3](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/action.ts#L3)

___

### LeafCallback

Ƭ **LeafCallback**: `LeafHandler`<`void`\>

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:77](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L77)

___

### LeafComponents

Ƭ **LeafComponents**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `field` | `string` |
| `operator` | [`Operator`](../enums/forestadmin_datasource_toolkit.Operator.md) |
| `value?` | `unknown` |

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:78](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L78)

___

### LeafReplacer

Ƭ **LeafReplacer**: `LeafHandler`<[`ConditionTree`](../classes/forestadmin_datasource_toolkit.ConditionTree.md) \| [`LeafComponents`](forestadmin_datasource_toolkit.md#leafcomponents)\>

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:74](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L74)

___

### LeafTester

Ƭ **LeafTester**: `LeafHandler`<`boolean`\>

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:76](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L76)

___

### ManyToManySchema

Ƭ **ManyToManySchema**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `foreignCollection` | `string` |
| `foreignKey` | `string` |
| `originRelation` | `string` |
| `otherField` | `string` |
| `targetRelation` | `string` |
| `throughCollection` | `string` |
| `type` | [`ManyToMany`](../enums/forestadmin_datasource_toolkit.FieldTypes.md#manytomany) |

#### Defined in

[packages/datasource-toolkit/src/interfaces/schema.ts:59](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/schema.ts#L59)

___

### ManyToOneSchema

Ƭ **ManyToOneSchema**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `foreignCollection` | `string` |
| `foreignKey` | `string` |
| `type` | [`ManyToOne`](../enums/forestadmin_datasource_toolkit.FieldTypes.md#manytoone) |

#### Defined in

[packages/datasource-toolkit/src/interfaces/schema.ts:41](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/schema.ts#L41)

___

### OneToManySchema

Ƭ **OneToManySchema**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `foreignCollection` | `string` |
| `foreignKey` | `string` |
| `type` | [`OneToMany`](../enums/forestadmin_datasource_toolkit.FieldTypes.md#onetomany) |

#### Defined in

[packages/datasource-toolkit/src/interfaces/schema.ts:47](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/schema.ts#L47)

___

### OneToOneSchema

Ƭ **OneToOneSchema**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `foreignCollection` | `string` |
| `foreignKey` | `string` |
| `type` | [`OneToOne`](../enums/forestadmin_datasource_toolkit.FieldTypes.md#onetoone) |

#### Defined in

[packages/datasource-toolkit/src/interfaces/schema.ts:53](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/schema.ts#L53)

___

### OperatorReplacer

Ƭ **OperatorReplacer**: (`value`: `unknown`, `dataSource`: [`DataSource`](../interfaces/forestadmin_datasource_toolkit.DataSource.md)) => `Promise`<[`ConditionTree`](../classes/forestadmin_datasource_toolkit.ConditionTree.md)\>

#### Type declaration

▸ (`value`, `dataSource`): `Promise`<[`ConditionTree`](../classes/forestadmin_datasource_toolkit.ConditionTree.md)\>

##### Parameters

| Name | Type |
| :------ | :------ |
| `value` | `unknown` |
| `dataSource` | [`DataSource`](../interfaces/forestadmin_datasource_toolkit.DataSource.md) |

##### Returns

`Promise`<[`ConditionTree`](../classes/forestadmin_datasource_toolkit.ConditionTree.md)\>

#### Defined in

[packages/datasource-toolkit/src/decorators/operators-emulate/types.ts:4](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/decorators/operators-emulate/types.ts#L4)

___

### PaginatedFilterComponents

Ƭ **PaginatedFilterComponents**: [`FilterComponents`](forestadmin_datasource_toolkit.md#filtercomponents) & { `page?`: [`Page`](../classes/forestadmin_datasource_toolkit.Page.md) ; `sort?`: [`Sort`](../classes/forestadmin_datasource_toolkit.Sort.md)  }

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/paginated.ts:5](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/filter/paginated.ts#L5)

___

### RecordData

Ƭ **RecordData**: `Object`

#### Index signature

▪ [field: `string`]: `unknown`

#### Defined in

[packages/datasource-toolkit/src/interfaces/record.ts:2](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/record.ts#L2)

___

### RedirectResult

Ƭ **RedirectResult**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `path` | `string` |
| `type` | [`Redirect`](../enums/forestadmin_datasource_toolkit.ActionResultType.md#redirect) |

#### Defined in

[packages/datasource-toolkit/src/interfaces/action.ts:75](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/action.ts#L75)

___

### RelationSchema

Ƭ **RelationSchema**: [`ManyToOneSchema`](forestadmin_datasource_toolkit.md#manytooneschema) \| [`OneToManySchema`](forestadmin_datasource_toolkit.md#onetomanyschema) \| [`OneToOneSchema`](forestadmin_datasource_toolkit.md#onetooneschema) \| [`ManyToManySchema`](forestadmin_datasource_toolkit.md#manytomanyschema)

#### Defined in

[packages/datasource-toolkit/src/interfaces/schema.ts:26](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/schema.ts#L26)

___

### SortClause

Ƭ **SortClause**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `ascending` | `boolean` |
| `field` | `string` |

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/sort/index.ts:5](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/query/sort/index.ts#L5)

___

### SuccessResult

Ƭ **SuccessResult**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `format` | ``"html"`` \| ``"text"`` |
| `invalidated` | `Set`<`string`\> |
| `message` | `string` |
| `type` | [`Success`](../enums/forestadmin_datasource_toolkit.ActionResultType.md#success) |

#### Defined in

[packages/datasource-toolkit/src/interfaces/action.ts:48](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/action.ts#L48)

___

### WebHookResult

Ƭ **WebHookResult**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `body` | `unknown` |
| `headers` | { `[key: string]`: `string`;  } |
| `method` | ``"GET"`` \| ``"POST"`` |
| `type` | [`Webhook`](../enums/forestadmin_datasource_toolkit.ActionResultType.md#webhook) |
| `url` | `string` |

#### Defined in

[packages/datasource-toolkit/src/interfaces/action.ts:60](https://github.com/ForestAdmin/agent-nodejs/blob/fba2435/packages/datasource-toolkit/src/interfaces/action.ts#L60)
