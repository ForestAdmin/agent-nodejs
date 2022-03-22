# Module: @forestadmin/agent

## Table of contents

### Enumerations

- [LoggerLevel](../wiki/@forestadmin.agent.LoggerLevel)

### Classes

- [Collection](../wiki/@forestadmin.agent.Collection)
- [default](../wiki/@forestadmin.agent.default)

### Type aliases

- [AgentOptions](../wiki/@forestadmin.agent#agentoptions)
- [Logger](../wiki/@forestadmin.agent#logger)

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
| `logger?` | [`Logger`](../wiki/@forestadmin.agent#logger) |
| `permissionsCacheDurationInSeconds?` | `number` |
| `prefix?` | `string` |
| `schemaPath?` | `string` |

#### Defined in

[packages/agent/src/types.ts:12](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/agent/src/types.ts#L12)

___

### Logger

Ƭ **Logger**: (`level`: [`LoggerLevel`](../wiki/@forestadmin.agent.LoggerLevel), `message`: `unknown`) => `void`

#### Type declaration

▸ (`level`, `message`): `void`

Logger

##### Parameters

| Name | Type |
| :------ | :------ |
| `level` | [`LoggerLevel`](../wiki/@forestadmin.agent.LoggerLevel) |
| `message` | `unknown` |

##### Returns

`void`

#### Defined in

[packages/agent/src/types.ts:9](https://github.com/ForestAdmin/agent-nodejs/blob/4dc29e4/packages/agent/src/types.ts#L9)
