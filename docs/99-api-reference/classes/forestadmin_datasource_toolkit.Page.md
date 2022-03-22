[root](../README.md) / [Modules](../modules.md) / [@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md) / Page

# Class: Page

[@forestadmin/datasource-toolkit](../modules/forestadmin_datasource_toolkit.md).Page

## Table of contents

### Constructors

- [constructor](forestadmin_datasource_toolkit.Page.md#constructor)

### Properties

- [limit](forestadmin_datasource_toolkit.Page.md#limit)
- [skip](forestadmin_datasource_toolkit.Page.md#skip)

### Methods

- [apply](forestadmin_datasource_toolkit.Page.md#apply)

## Constructors

### constructor

• **new Page**(`skip?`, `limit?`)

#### Parameters

| Name | Type |
| :------ | :------ |
| `skip?` | `number` |
| `limit?` | `number` |

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/page.ts:7](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/interfaces/query/page.ts#L7)

## Properties

### limit

• **limit**: `number`

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/page.ts:5](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/interfaces/query/page.ts#L5)

___

### skip

• **skip**: `number`

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/page.ts:4](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/interfaces/query/page.ts#L4)

## Methods

### apply

▸ **apply**(`records`): [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[]

#### Parameters

| Name | Type |
| :------ | :------ |
| `records` | [`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[] |

#### Returns

[`RecordData`](../modules/forestadmin_datasource_toolkit.md#recorddata)[]

#### Defined in

[packages/datasource-toolkit/src/interfaces/query/page.ts:12](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/datasource-toolkit/src/interfaces/query/page.ts#L12)
