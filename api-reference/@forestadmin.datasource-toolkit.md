# Module: @forestadmin/datasource-toolkit

## Table of contents

### Enumerations

- [ActionFieldType](../wiki/@forestadmin.datasource-toolkit.ActionFieldType)
- [ActionResultType](../wiki/@forestadmin.datasource-toolkit.ActionResultType)
- [ActionScope](../wiki/@forestadmin.datasource-toolkit.ActionScope)
- [AggregationOperation](../wiki/@forestadmin.datasource-toolkit.AggregationOperation)
- [Aggregator](../wiki/@forestadmin.datasource-toolkit.Aggregator)
- [DateOperation](../wiki/@forestadmin.datasource-toolkit.DateOperation)
- [FieldTypes](../wiki/@forestadmin.datasource-toolkit.FieldTypes)
- [Operator](../wiki/@forestadmin.datasource-toolkit.Operator)
- [PrimitiveTypes](../wiki/@forestadmin.datasource-toolkit.PrimitiveTypes)

### Classes

- [ActionCollectionDecorator](../wiki/@forestadmin.datasource-toolkit.ActionCollectionDecorator)
- [Aggregation](../wiki/@forestadmin.datasource-toolkit.Aggregation)
- [BaseCollection](../wiki/@forestadmin.datasource-toolkit.BaseCollection)
- [BaseDataSource](../wiki/@forestadmin.datasource-toolkit.BaseDataSource)
- [CollectionUtils](../wiki/@forestadmin.datasource-toolkit.CollectionUtils)
- [ComputedCollectionDecorator](../wiki/@forestadmin.datasource-toolkit.ComputedCollectionDecorator)
- [ConditionTree](../wiki/@forestadmin.datasource-toolkit.ConditionTree)
- [ConditionTreeBranch](../wiki/@forestadmin.datasource-toolkit.ConditionTreeBranch)
- [ConditionTreeFactory](../wiki/@forestadmin.datasource-toolkit.ConditionTreeFactory)
- [ConditionTreeLeaf](../wiki/@forestadmin.datasource-toolkit.ConditionTreeLeaf)
- [ConditionTreeNot](../wiki/@forestadmin.datasource-toolkit.ConditionTreeNot)
- [ConditionTreeValidator](../wiki/@forestadmin.datasource-toolkit.ConditionTreeValidator)
- [DataSourceDecorator](../wiki/@forestadmin.datasource-toolkit.DataSourceDecorator)
- [FieldValidator](../wiki/@forestadmin.datasource-toolkit.FieldValidator)
- [Filter](../wiki/@forestadmin.datasource-toolkit.Filter)
- [FilterFactory](../wiki/@forestadmin.datasource-toolkit.FilterFactory)
- [JointureCollectionDecorator](../wiki/@forestadmin.datasource-toolkit.JointureCollectionDecorator)
- [OperatorsEmulateCollectionDecorator](../wiki/@forestadmin.datasource-toolkit.OperatorsEmulateCollectionDecorator)
- [OperatorsReplaceCollectionDecorator](../wiki/@forestadmin.datasource-toolkit.OperatorsReplaceCollectionDecorator)
- [Page](../wiki/@forestadmin.datasource-toolkit.Page)
- [PaginatedFilter](../wiki/@forestadmin.datasource-toolkit.PaginatedFilter)
- [Projection](../wiki/@forestadmin.datasource-toolkit.Projection)
- [ProjectionValidator](../wiki/@forestadmin.datasource-toolkit.ProjectionValidator)
- [PublicationCollectionDecorator](../wiki/@forestadmin.datasource-toolkit.PublicationCollectionDecorator)
- [RecordUtils](../wiki/@forestadmin.datasource-toolkit.RecordUtils)
- [RecordValidator](../wiki/@forestadmin.datasource-toolkit.RecordValidator)
- [RenameCollectionDecorator](../wiki/@forestadmin.datasource-toolkit.RenameCollectionDecorator)
- [SchemaUtils](../wiki/@forestadmin.datasource-toolkit.SchemaUtils)
- [SearchCollectionDecorator](../wiki/@forestadmin.datasource-toolkit.SearchCollectionDecorator)
- [SegmentCollectionDecorator](../wiki/@forestadmin.datasource-toolkit.SegmentCollectionDecorator)
- [Sort](../wiki/@forestadmin.datasource-toolkit.Sort)
- [SortEmulateCollectionDecorator](../wiki/@forestadmin.datasource-toolkit.SortEmulateCollectionDecorator)
- [SortFactory](../wiki/@forestadmin.datasource-toolkit.SortFactory)
- [SortValidator](../wiki/@forestadmin.datasource-toolkit.SortValidator)
- [ValidationError](../wiki/@forestadmin.datasource-toolkit.ValidationError)

### Interfaces

- [ActionField](../wiki/@forestadmin.datasource-toolkit.ActionField)
- [AggregationGroup](../wiki/@forestadmin.datasource-toolkit.AggregationGroup)
- [Collection](../wiki/@forestadmin.datasource-toolkit.Collection)
- [ComputedDefinition](../wiki/@forestadmin.datasource-toolkit.ComputedDefinition)
- [DataSource](../wiki/@forestadmin.datasource-toolkit.DataSource)
- [ProxyDefinition](../wiki/@forestadmin.datasource-toolkit.ProxyDefinition)

### Type aliases

- [ActionDefinition](../wiki/@forestadmin.datasource-toolkit#actiondefinition)
- [ActionResult](../wiki/@forestadmin.datasource-toolkit#actionresult)
- [ActionSchema](../wiki/@forestadmin.datasource-toolkit#actionschema)
- [AggregateResult](../wiki/@forestadmin.datasource-toolkit#aggregateresult)
- [AsyncLeafReplacer](../wiki/@forestadmin.datasource-toolkit#asyncleafreplacer)
- [BranchComponents](../wiki/@forestadmin.datasource-toolkit#branchcomponents)
- [CollectionSchema](../wiki/@forestadmin.datasource-toolkit#collectionschema)
- [ColumnSchema](../wiki/@forestadmin.datasource-toolkit#columnschema)
- [ColumnType](../wiki/@forestadmin.datasource-toolkit#columntype)
- [CompositeId](../wiki/@forestadmin.datasource-toolkit#compositeid)
- [ComputedContext](../wiki/@forestadmin.datasource-toolkit#computedcontext)
- [DataSourceSchema](../wiki/@forestadmin.datasource-toolkit#datasourceschema)
- [ErrorResult](../wiki/@forestadmin.datasource-toolkit#errorresult)
- [FieldSchema](../wiki/@forestadmin.datasource-toolkit#fieldschema)
- [File](../wiki/@forestadmin.datasource-toolkit#file)
- [FileResult](../wiki/@forestadmin.datasource-toolkit#fileresult)
- [FilterComponents](../wiki/@forestadmin.datasource-toolkit#filtercomponents)
- [Json](../wiki/@forestadmin.datasource-toolkit#json)
- [LeafCallback](../wiki/@forestadmin.datasource-toolkit#leafcallback)
- [LeafComponents](../wiki/@forestadmin.datasource-toolkit#leafcomponents)
- [LeafReplacer](../wiki/@forestadmin.datasource-toolkit#leafreplacer)
- [LeafTester](../wiki/@forestadmin.datasource-toolkit#leaftester)
- [ManyToManySchema](../wiki/@forestadmin.datasource-toolkit#manytomanyschema)
- [ManyToOneSchema](../wiki/@forestadmin.datasource-toolkit#manytooneschema)
- [OneToManySchema](../wiki/@forestadmin.datasource-toolkit#onetomanyschema)
- [OneToOneSchema](../wiki/@forestadmin.datasource-toolkit#onetooneschema)
- [OperatorReplacer](../wiki/@forestadmin.datasource-toolkit#operatorreplacer)
- [PaginatedFilterComponents](../wiki/@forestadmin.datasource-toolkit#paginatedfiltercomponents)
- [RecordData](../wiki/@forestadmin.datasource-toolkit#recorddata)
- [RedirectResult](../wiki/@forestadmin.datasource-toolkit#redirectresult)
- [RelationSchema](../wiki/@forestadmin.datasource-toolkit#relationschema)
- [SortClause](../wiki/@forestadmin.datasource-toolkit#sortclause)
- [SuccessResult](../wiki/@forestadmin.datasource-toolkit#successresult)
- [WebHookResult](../wiki/@forestadmin.datasource-toolkit#webhookresult)

## Type aliases

### ActionDefinition

Ƭ **ActionDefinition**: `ActionSingle` \| `ActionBulk` \| `ActionGlobal`

#### Defined in

[packages/datasource-toolkit/src/decorators/actions/types/actions.ts:22](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/actions/types/actions.ts#L22)

___

### ActionResult

Ƭ **ActionResult**: [`SuccessResult`](../wiki/@forestadmin.datasource-toolkit#successresult) \| [`ErrorResult`](../wiki/@forestadmin.datasource-toolkit#errorresult) \| [`WebHookResult`](../wiki/@forestadmin.datasource-toolkit#webhookresult) \| [`FileResult`](../wiki/@forestadmin.datasource-toolkit#fileresult) \| [`RedirectResult`](../wiki/@forestadmin.datasource-toolkit#redirectresult)

#### Defined in

[packages/datasource-toolkit/src/interfaces/action.ts:80](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/action.ts#L80)

___

### ActionSchema

Ƭ **ActionSchema**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `generateFile?` | `boolean` |
| `scope` | [`ActionScope`](../wiki/@forestadmin.datasource-toolkit.ActionScope) |
| `staticForm?` | `boolean` |

#### Defined in

[packages/datasource-toolkit/src/interfaces/schema.ts:9](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/schema.ts#L9)

___

### AggregateResult

Ƭ **AggregateResult**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `group` | { `[field: string]`: `unknown`;  } |
| `value` | `unknown` |

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/aggregation.ts:23](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/aggregation.ts#L23)

___

### AsyncLeafReplacer

Ƭ **AsyncLeafReplacer**: `LeafHandler`<`Promise`<[`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree) \| [`LeafComponents`](../wiki/@forestadmin.datasource-toolkit#leafcomponents)\>\>

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:75](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L75)

___

### BranchComponents

Ƭ **BranchComponents**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `aggregator` | [`Aggregator`](../wiki/@forestadmin.datasource-toolkit.Aggregator) |
| `conditions` | ([`BranchComponents`](../wiki/@forestadmin.datasource-toolkit#branchcomponents) \| [`LeafComponents`](../wiki/@forestadmin.datasource-toolkit#leafcomponents))[] |

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts:12](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/branch.ts#L12)

___

### CollectionSchema

Ƭ **CollectionSchema**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `actions` | { `[actionName: string]`: [`ActionSchema`](../wiki/@forestadmin.datasource-toolkit#actionschema);  } |
| `fields` | { `[fieldName: string]`: [`FieldSchema`](../wiki/@forestadmin.datasource-toolkit#fieldschema);  } |
| `searchable` | `boolean` |
| `segments` | `string`[] |

#### Defined in

[packages/datasource-toolkit/src/interfaces/schema.ts:15](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/schema.ts#L15)

___

### ColumnSchema

Ƭ **ColumnSchema**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `columnType` | [`ColumnType`](../wiki/@forestadmin.datasource-toolkit#columntype) |
| `defaultValue?` | `unknown` |
| `enumValues?` | `string`[] |
| `filterOperators?` | `Set`<[`Operator`](../wiki/@forestadmin.datasource-toolkit.Operator)\> |
| `isPrimaryKey?` | `boolean` |
| `isReadOnly?` | `boolean` |
| `isSortable?` | `boolean` |
| `type` | [`Column`](../wiki/@forestadmin.datasource-toolkit.FieldTypes#column) |
| `validation?` | { `operator`: [`Operator`](../wiki/@forestadmin.datasource-toolkit.Operator) ; `value?`: `unknown`  }[] |

#### Defined in

[packages/datasource-toolkit/src/interfaces/schema.ts:29](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/schema.ts#L29)

___

### ColumnType

Ƭ **ColumnType**: [`PrimitiveTypes`](../wiki/@forestadmin.datasource-toolkit.PrimitiveTypes) \| { `[key: string]`: [`ColumnType`](../wiki/@forestadmin.datasource-toolkit#columntype);  } \| [[`ColumnType`](../wiki/@forestadmin.datasource-toolkit#columntype)]

#### Defined in

[packages/datasource-toolkit/src/interfaces/schema.ts:69](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/schema.ts#L69)

___

### CompositeId

Ƭ **CompositeId**: (`number` \| `string`)[]

#### Defined in

[packages/datasource-toolkit/src/interfaces/record.ts:1](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/record.ts#L1)

___

### ComputedContext

Ƭ **ComputedContext**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `dataSource` | [`DataSource`](../wiki/@forestadmin.datasource-toolkit.DataSource) |

#### Defined in

[packages/datasource-toolkit/src/decorators/computed/types.ts:6](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/computed/types.ts#L6)

___

### DataSourceSchema

Ƭ **DataSourceSchema**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `collections` | { `[name: string]`: [`CollectionSchema`](../wiki/@forestadmin.datasource-toolkit#collectionschema);  } |

#### Defined in

[packages/datasource-toolkit/src/interfaces/schema.ts:22](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/schema.ts#L22)

___

### ErrorResult

Ƭ **ErrorResult**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `message` | `string` |
| `type` | [`Error`](../wiki/@forestadmin.datasource-toolkit.ActionResultType#error) |

#### Defined in

[packages/datasource-toolkit/src/interfaces/action.ts:55](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/action.ts#L55)

___

### FieldSchema

Ƭ **FieldSchema**: [`ColumnSchema`](../wiki/@forestadmin.datasource-toolkit#columnschema) \| [`RelationSchema`](../wiki/@forestadmin.datasource-toolkit#relationschema)

#### Defined in

[packages/datasource-toolkit/src/interfaces/schema.ts:27](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/schema.ts#L27)

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

[packages/datasource-toolkit/src/interfaces/action.ts:5](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/action.ts#L5)

___

### FileResult

Ƭ **FileResult**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `mimeType` | `string` |
| `name` | `string` |
| `stream` | `Readable` |
| `type` | [`File`](../wiki/@forestadmin.datasource-toolkit.ActionResultType#file) |

#### Defined in

[packages/datasource-toolkit/src/interfaces/action.ts:68](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/action.ts#L68)

___

### FilterComponents

Ƭ **FilterComponents**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `conditionTree?` | [`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree) |
| `search?` | `string` |
| `searchExtended?` | `boolean` |
| `segment?` | `string` |
| `timezone?` | `string` |

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts:3](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/filter/unpaginated.ts#L3)

___

### Json

Ƭ **Json**: `string` \| `number` \| `boolean` \| { `[x: string]`: [`Json`](../wiki/@forestadmin.datasource-toolkit#json);  } \| [`Json`](../wiki/@forestadmin.datasource-toolkit#json)[]

#### Defined in

[packages/datasource-toolkit/src/interfaces/action.ts:3](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/action.ts#L3)

___

### LeafCallback

Ƭ **LeafCallback**: `LeafHandler`<`void`\>

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:77](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L77)

___

### LeafComponents

Ƭ **LeafComponents**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `field` | `string` |
| `operator` | [`Operator`](../wiki/@forestadmin.datasource-toolkit.Operator) |
| `value?` | `unknown` |

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:78](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L78)

___

### LeafReplacer

Ƭ **LeafReplacer**: `LeafHandler`<[`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree) \| [`LeafComponents`](../wiki/@forestadmin.datasource-toolkit#leafcomponents)\>

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:74](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L74)

___

### LeafTester

Ƭ **LeafTester**: `LeafHandler`<`boolean`\>

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts:76](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/condition-tree/nodes/leaf.ts#L76)

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
| `type` | [`ManyToMany`](../wiki/@forestadmin.datasource-toolkit.FieldTypes#manytomany) |

#### Defined in

[packages/datasource-toolkit/src/interfaces/schema.ts:59](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/schema.ts#L59)

___

### ManyToOneSchema

Ƭ **ManyToOneSchema**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `foreignCollection` | `string` |
| `foreignKey` | `string` |
| `type` | [`ManyToOne`](../wiki/@forestadmin.datasource-toolkit.FieldTypes#manytoone) |

#### Defined in

[packages/datasource-toolkit/src/interfaces/schema.ts:41](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/schema.ts#L41)

___

### OneToManySchema

Ƭ **OneToManySchema**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `foreignCollection` | `string` |
| `foreignKey` | `string` |
| `type` | [`OneToMany`](../wiki/@forestadmin.datasource-toolkit.FieldTypes#onetomany) |

#### Defined in

[packages/datasource-toolkit/src/interfaces/schema.ts:47](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/schema.ts#L47)

___

### OneToOneSchema

Ƭ **OneToOneSchema**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `foreignCollection` | `string` |
| `foreignKey` | `string` |
| `type` | [`OneToOne`](../wiki/@forestadmin.datasource-toolkit.FieldTypes#onetoone) |

#### Defined in

[packages/datasource-toolkit/src/interfaces/schema.ts:53](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/schema.ts#L53)

___

### OperatorReplacer

Ƭ **OperatorReplacer**: (`value`: `unknown`, `dataSource`: [`DataSource`](../wiki/@forestadmin.datasource-toolkit.DataSource)) => `Promise`<[`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)\>

#### Type declaration

▸ (`value`, `dataSource`): `Promise`<[`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)\>

##### Parameters

| Name | Type |
| :------ | :------ |
| `value` | `unknown` |
| `dataSource` | [`DataSource`](../wiki/@forestadmin.datasource-toolkit.DataSource) |

##### Returns

`Promise`<[`ConditionTree`](../wiki/@forestadmin.datasource-toolkit.ConditionTree)\>

#### Defined in

[packages/datasource-toolkit/src/decorators/operators-emulate/types.ts:4](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/decorators/operators-emulate/types.ts#L4)

___

### PaginatedFilterComponents

Ƭ **PaginatedFilterComponents**: [`FilterComponents`](../wiki/@forestadmin.datasource-toolkit#filtercomponents) & { `page?`: [`Page`](../wiki/@forestadmin.datasource-toolkit.Page) ; `sort?`: [`Sort`](../wiki/@forestadmin.datasource-toolkit.Sort)  }

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/filter/paginated.ts:5](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/filter/paginated.ts#L5)

___

### RecordData

Ƭ **RecordData**: `Object`

#### Index signature

▪ [field: `string`]: `unknown`

#### Defined in

[packages/datasource-toolkit/src/interfaces/record.ts:2](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/record.ts#L2)

___

### RedirectResult

Ƭ **RedirectResult**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `path` | `string` |
| `type` | [`Redirect`](../wiki/@forestadmin.datasource-toolkit.ActionResultType#redirect) |

#### Defined in

[packages/datasource-toolkit/src/interfaces/action.ts:75](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/action.ts#L75)

___

### RelationSchema

Ƭ **RelationSchema**: [`ManyToOneSchema`](../wiki/@forestadmin.datasource-toolkit#manytooneschema) \| [`OneToManySchema`](../wiki/@forestadmin.datasource-toolkit#onetomanyschema) \| [`OneToOneSchema`](../wiki/@forestadmin.datasource-toolkit#onetooneschema) \| [`ManyToManySchema`](../wiki/@forestadmin.datasource-toolkit#manytomanyschema)

#### Defined in

[packages/datasource-toolkit/src/interfaces/schema.ts:26](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/schema.ts#L26)

___

### SortClause

Ƭ **SortClause**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `ascending` | `boolean` |
| `field` | `string` |

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/sort/index.ts:5](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/query/sort/index.ts#L5)

___

### SuccessResult

Ƭ **SuccessResult**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `format` | ``"html"`` \| ``"text"`` |
| `invalidated` | `Set`<`string`\> |
| `message` | `string` |
| `type` | [`Success`](../wiki/@forestadmin.datasource-toolkit.ActionResultType#success) |

#### Defined in

[packages/datasource-toolkit/src/interfaces/action.ts:48](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/action.ts#L48)

___

### WebHookResult

Ƭ **WebHookResult**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `body` | `unknown` |
| `headers` | { `[key: string]`: `string`;  } |
| `method` | ``"GET"`` \| ``"POST"`` |
| `type` | [`Webhook`](../wiki/@forestadmin.datasource-toolkit.ActionResultType#webhook) |
| `url` | `string` |

#### Defined in

[packages/datasource-toolkit/src/interfaces/action.ts:60](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/datasource-toolkit/src/interfaces/action.ts#L60)
