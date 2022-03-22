[root](../README.md) / [Modules](../modules.md) / @forestadmin/agent

# Module: @forestadmin/agent

## Table of contents

### Enumerations

- [LoggerLevel](../enums/forestadmin_agent.LoggerLevel.md)

### Classes

- [Collection](../classes/forestadmin_agent.Collection.md)
- [default](../classes/forestadmin_agent.default.md)

### Type aliases

- [AgentOptions](forestadmin_agent.md#agentoptions)
- [Logger](forestadmin_agent.md#logger)

## Type aliases

### AgentOptions

Ƭ **AgentOptions**: `Object`

Options to configure behavior of an agent's forestadmin driver

#### Type declaration

| Name | Type |
| :------ | :------ |
| `agentUrl` | `string` |
| `authSecret` | `string` |
| `clientId?` | `string` |
| `envSecret` | `string` |
| `forestServerUrl?` | `string` |
| `isProduction` | `boolean` |
| `logger?` | [`Logger`](forestadmin_agent.md#logger) |
| `permissionsCacheDurationInSeconds?` | `number` |
| `prefix?` | `string` |
| `schemaPath?` | `string` |

#### Defined in

[packages/agent/src/types.ts:12](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/agent/src/types.ts#L12)

___

### Logger

Ƭ **Logger**: (`level`: [`LoggerLevel`](../enums/forestadmin_agent.LoggerLevel.md), `message`: `unknown`) => `void`

#### Type declaration

▸ (`level`, `message`): `void`

Logger

##### Parameters

| Name | Type |
| :------ | :------ |
| `level` | [`LoggerLevel`](../enums/forestadmin_agent.LoggerLevel.md) |
| `message` | `unknown` |

##### Returns

`void`

#### Defined in

[packages/agent/src/types.ts:9](https://github.com/ForestAdmin/agent-nodejs/blob/ab7dfd8/packages/agent/src/types.ts#L9)
