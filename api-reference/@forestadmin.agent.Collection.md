# Class: Collection

[@forestadmin/agent](../wiki/@forestadmin.agent).Collection

## Table of contents

### Constructors

- [constructor](../wiki/@forestadmin.agent.Collection#constructor)

### Methods

- [emulateOperator](../wiki/@forestadmin.agent.Collection#emulateoperator)
- [emulateSort](../wiki/@forestadmin.agent.Collection#emulatesort)
- [implementOperator](../wiki/@forestadmin.agent.Collection#implementoperator)
- [implementSort](../wiki/@forestadmin.agent.Collection#implementsort)
- [publishFields](../wiki/@forestadmin.agent.Collection#publishfields)
- [registerAction](../wiki/@forestadmin.agent.Collection#registeraction)
- [registerField](../wiki/@forestadmin.agent.Collection#registerfield)
- [registerSegment](../wiki/@forestadmin.agent.Collection#registersegment)
- [renameField](../wiki/@forestadmin.agent.Collection#renamefield)
- [unpublishFields](../wiki/@forestadmin.agent.Collection#unpublishfields)

## Constructors

### constructor

• **new Collection**(`agentBuilder`, `name`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `agentBuilder` | [`default`](../wiki/@forestadmin.agent.default) |
| `name` | `string` |

#### Defined in

[packages/agent/src/builder/collection.ts:18](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/agent/src/builder/collection.ts#L18)

## Methods

### emulateOperator

▸ **emulateOperator**(`name`, `operator`): [`Collection`](../wiki/@forestadmin.agent.Collection)

Enable filtering on a specific field with a specific operator using emulation.
As for all the emulation method, the field filtering will be done in-memory.

**`example`**
```
.emulateOperator('aField', Operator.In);
```

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `name` | `string` | the name of the field to enable emulation on |
| `operator` | `Operator` | the operator to emulate |

#### Returns

[`Collection`](../wiki/@forestadmin.agent.Collection)

#### Defined in

[packages/agent/src/builder/collection.ts:195](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/agent/src/builder/collection.ts#L195)

___

### emulateSort

▸ **emulateSort**(`name`): [`Collection`](../wiki/@forestadmin.agent.Collection)

Enable sorting on a specific field using emulation.
As for all the emulation method, the field sorting will be done in-memory.

**`example`**
```
.emulateSort('fullName');
```

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `name` | `string` | the name of the field to enable emulation on |

#### Returns

[`Collection`](../wiki/@forestadmin.agent.Collection)

#### Defined in

[packages/agent/src/builder/collection.ts:156](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/agent/src/builder/collection.ts#L156)

___

### implementOperator

▸ **implementOperator**(`name`, `operator`, `replacer`): [`Collection`](../wiki/@forestadmin.agent.Collection)

Allow to provide an implementation for a specific operator on a specific field.

**`example`**
```
.implementOperator('booksCount', Operator.Equal, async (value: unknown) => {
   return new ConditionTreeNot(
     new ConditionTreeLeaf('booksCount', Operator.Equal, value),
   );
});
```

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `name` | `string` | the name of the field to filter on |
| `operator` | `Operator` | the operator to implement |
| `replacer` | `OperatorReplacer` | the proposed implementation |

#### Returns

[`Collection`](../wiki/@forestadmin.agent.Collection)

#### Defined in

[packages/agent/src/builder/collection.ts:215](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/agent/src/builder/collection.ts#L215)

___

### implementSort

▸ **implementSort**(`name`, `equivalentSort`): [`Collection`](../wiki/@forestadmin.agent.Collection)

Allow to provide an implementation for the sorting.

**`example`**
```
.implementSort(
  'fullName',
  [
    { field: 'firstName', ascending: true },
    { field: 'lastName',  ascending: true },
  ]
)
```

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `name` | `string` | the name of the field to enable sort |
| `equivalentSort` | `SortClause`[] | the sort equivalent |

#### Returns

[`Collection`](../wiki/@forestadmin.agent.Collection)

#### Defined in

[packages/agent/src/builder/collection.ts:177](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/agent/src/builder/collection.ts#L177)

___

### publishFields

▸ **publishFields**(`names`): [`Collection`](../wiki/@forestadmin.agent.Collection)

Publish an array of fields by setting its visibility to true.

**`example`**
```
.publishFields(['aFieldToPublish']);
```

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `names` | `string`[] | the array of field to publish |

#### Returns

[`Collection`](../wiki/@forestadmin.agent.Collection)

#### Defined in

[packages/agent/src/builder/collection.ts:46](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/agent/src/builder/collection.ts#L46)

___

### registerAction

▸ **registerAction**(`name`, `definition`): [`Collection`](../wiki/@forestadmin.agent.Collection)

Register a new action on the collection

**`example`**
```
.registerAction('is live', {
scope: ActionScope.Single,
execute: async (context, responseBuilder) => {
return responseBuilder.success(`Is live!`);
},
})
```

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `name` | `string` | the name of the action |
| `definition` | `Action` | the definition of the action |

#### Returns

[`Collection`](../wiki/@forestadmin.agent.Collection)

#### Defined in

[packages/agent/src/builder/collection.ts:82](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/agent/src/builder/collection.ts#L82)

___

### registerField

▸ **registerField**(`name`, `definition`): [`Collection`](../wiki/@forestadmin.agent.Collection)

Register a new field on the collection.

**`example`**
```
.registerField('fullName', {
   columnType: PrimitiveTypes.String,
   dependencies: ['firstName', 'lastName'],
   getValues: (records) => records.map(record => `${record.lastName} ${record.firstName}`),
});
```

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `name` | `string` | the name of the field |
| `definition` | `FieldDefinition` | The definition of the field |

#### Returns

[`Collection`](../wiki/@forestadmin.agent.Collection)

#### Defined in

[packages/agent/src/builder/collection.ts:101](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/agent/src/builder/collection.ts#L101)

___

### registerSegment

▸ **registerSegment**(`name`, `conditionTreeGenerator`): `void`

Register a new segment on the collection.

**`example`**
```
.registerSegment(
   'Wrote more than 2 books',
   async (timezone) => new ConditionTreeLeaf('booksCount', Operator.GreaterThan, 2),
);
```

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `name` | `string` | the name of the segment |
| `conditionTreeGenerator` | (`timezone`: `string`) => `Promise`<`default`\> | a function used   to generate a condition tree |

#### Returns

`void`

#### Defined in

[packages/agent/src/builder/collection.ts:138](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/agent/src/builder/collection.ts#L138)

___

### renameField

▸ **renameField**(`oldName`, `newName`): [`Collection`](../wiki/@forestadmin.agent.Collection)

Allow to rename a field of a given collection.

**`example`**
```
.renameField('theCurrentNameOfTheFieldIntheCollection', 'theNewNameOfTheField');
```

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `oldName` | `string` | the current name of the field in a given collection |
| `newName` | `string` | the new name of the field |

#### Returns

[`Collection`](../wiki/@forestadmin.agent.Collection)

#### Defined in

[packages/agent/src/builder/collection.ts:32](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/agent/src/builder/collection.ts#L32)

___

### unpublishFields

▸ **unpublishFields**(`names`): [`Collection`](../wiki/@forestadmin.agent.Collection)

Unpublish an array of fields by setting its visibility to false.

**`example`**
```
.unpublishFields(['aFieldToUnpublish']);
```

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `names` | `string`[] | the array of field to unpublish |

#### Returns

[`Collection`](../wiki/@forestadmin.agent.Collection)

#### Defined in

[packages/agent/src/builder/collection.ts:61](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/agent/src/builder/collection.ts#L61)
