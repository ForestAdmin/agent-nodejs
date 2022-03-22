[root](../README.md) / [Modules](../modules.md) / [@forestadmin/agent](../modules/forestadmin_agent.md) / default

# Class: default

[@forestadmin/agent](../modules/forestadmin_agent.md).default

Allow to create a new Forest Admin agent from scratch.
Builds the application by composing and configuring all the collection decorators.

**`example`**
Minimal code to add a datasource
```
new AgentBuilder(options)
 .addDatasource(new SomeDatasource())
 .start();
```

## Table of contents

### Constructors

- [constructor](forestadmin_agent.default.md#constructor)

### Properties

- [action](forestadmin_agent.default.md#action)
- [compositeDatasource](forestadmin_agent.default.md#compositedatasource)
- [computed](forestadmin_agent.default.md#computed)
- [forestAdminHttpDriver](forestadmin_agent.default.md#forestadminhttpdriver)
- [operatorEmulate](forestadmin_agent.default.md#operatoremulate)
- [operatorReplace](forestadmin_agent.default.md#operatorreplace)
- [publication](forestadmin_agent.default.md#publication)
- [rename](forestadmin_agent.default.md#rename)
- [search](forestadmin_agent.default.md#search)
- [segment](forestadmin_agent.default.md#segment)
- [sortEmulate](forestadmin_agent.default.md#sortemulate)

### Accessors

- [httpCallback](forestadmin_agent.default.md#httpcallback)

### Methods

- [addDatasource](forestadmin_agent.default.md#adddatasource)
- [customizeCollection](forestadmin_agent.default.md#customizecollection)
- [start](forestadmin_agent.default.md#start)
- [stop](forestadmin_agent.default.md#stop)

## Constructors

### constructor

• **new default**(`options`)

Create a new Agent Builder.
If any options are missing, the default will be applied:
```
 clientId: null,
 forestServerUrl: 'https://api.forestadmin.com',
 logger: (level, data) => console.error(OptionsUtils.loggerPrefix[level], data),
 prefix: '/forest',
 schemaPath: '.forestadmin-schema.json',
 permissionsCacheDurationInSeconds: 15 * 60,
```

**`example`**
```
new AgentBuilder(options)
 .addDatasource(new Datasource())
 .start();
```

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `options` | [`AgentOptions`](../modules/forestadmin_agent.md#agentoptions) | options |

#### Defined in

[packages/agent/src/builder/agent.ts:88](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/agent/src/builder/agent.ts#L88)

## Properties

### action

• **action**: `default`<`default`\>

#### Defined in

[packages/agent/src/builder/agent.ts:52](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/agent/src/builder/agent.ts#L52)

___

### compositeDatasource

• **compositeDatasource**: `default`<`Collection`\>

#### Defined in

[packages/agent/src/builder/agent.ts:34](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/agent/src/builder/agent.ts#L34)

___

### computed

• **computed**: `default`<`default`\>

#### Defined in

[packages/agent/src/builder/agent.ts:40](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/agent/src/builder/agent.ts#L40)

___

### forestAdminHttpDriver

• **forestAdminHttpDriver**: `default`

#### Defined in

[packages/agent/src/builder/agent.ts:54](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/agent/src/builder/agent.ts#L54)

___

### operatorEmulate

• **operatorEmulate**: `default`<`default`\>

#### Defined in

[packages/agent/src/builder/agent.ts:36](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/agent/src/builder/agent.ts#L36)

___

### operatorReplace

• **operatorReplace**: `default`<`default`\>

#### Defined in

[packages/agent/src/builder/agent.ts:38](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/agent/src/builder/agent.ts#L38)

___

### publication

• **publication**: `default`<`default`\>

#### Defined in

[packages/agent/src/builder/agent.ts:46](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/agent/src/builder/agent.ts#L46)

___

### rename

• **rename**: `default`<`default`\>

#### Defined in

[packages/agent/src/builder/agent.ts:44](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/agent/src/builder/agent.ts#L44)

___

### search

• **search**: `default`<`default`\>

#### Defined in

[packages/agent/src/builder/agent.ts:50](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/agent/src/builder/agent.ts#L50)

___

### segment

• **segment**: `default`<`default`\>

#### Defined in

[packages/agent/src/builder/agent.ts:42](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/agent/src/builder/agent.ts#L42)

___

### sortEmulate

• **sortEmulate**: `default`<`default`\>

#### Defined in

[packages/agent/src/builder/agent.ts:48](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/agent/src/builder/agent.ts#L48)

## Accessors

### httpCallback

• `get` **httpCallback**(): `HttpCallback`

Native nodejs HttpCallback object

**`example`**
```
import http from 'http';
...
const server = http.createServer(agent.httpCallback);
```

#### Returns

`HttpCallback`

#### Defined in

[packages/agent/src/builder/agent.ts:65](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/agent/src/builder/agent.ts#L65)

## Methods

### addDatasource

▸ **addDatasource**(`datasource`): [`default`](forestadmin_agent.default.md)

Add a datasource

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `datasource` | `DataSource` | the datasource to add |

#### Returns

[`default`](forestadmin_agent.default.md)

#### Defined in

[packages/agent/src/builder/agent.ts:117](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/agent/src/builder/agent.ts#L117)

___

### customizeCollection

▸ **customizeCollection**(`name`, `handle`): [`default`](forestadmin_agent.default.md)

Allow to interact with a decorated collection

**`example`**
```
.customizeCollection('books', books => books.renameField('xx', 'yy'))
```

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `name` | `string` | the name of the collection to manipulate |
| `handle` | (`collection`: [`Collection`](forestadmin_agent.Collection.md)) => `unknown` | a function that provide a   collection builder on the given collection name |

#### Returns

[`default`](forestadmin_agent.default.md)

#### Defined in

[packages/agent/src/builder/agent.ts:135](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/agent/src/builder/agent.ts#L135)

___

### start

▸ **start**(): `Promise`<`void`\>

Start the agent.

#### Returns

`Promise`<`void`\>

#### Defined in

[packages/agent/src/builder/agent.ts:146](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/agent/src/builder/agent.ts#L146)

___

### stop

▸ **stop**(): `Promise`<`void`\>

Stop the agent gracefully.

#### Returns

`Promise`<`void`\>

#### Defined in

[packages/agent/src/builder/agent.ts:153](https://github.com/ForestAdmin/agent-nodejs/blob/0eb369e/packages/agent/src/builder/agent.ts#L153)
