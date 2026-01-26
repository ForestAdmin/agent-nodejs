# @forestadmin/ai-proxy

AI Proxy package for Forest Admin agents. Provides both server-side routing and a client SDK for frontend/agent-client usage.

## Installation

### Client only (frontend)

```bash
npm install @forestadmin/ai-proxy
```

No additional dependencies required.

### Server-side (with Router, ProviderDispatcher)

```bash
npm install @forestadmin/ai-proxy @langchain/core @langchain/openai @langchain/community @langchain/mcp-adapters
```

Langchain packages are optional peer dependencies - install them only if you use the server-side features.

## Client Usage

The `AiProxyClient` provides a simple API to interact with the AI proxy from a frontend or agent-client.

> **Note:** Import from `@forestadmin/ai-proxy/client` for a lightweight client without langchain dependencies.

### Setup

```typescript
// Lightweight import - no langchain dependencies (recommended for frontend)
import { createAiProxyClient } from '@forestadmin/ai-proxy/client';

const client = createAiProxyClient({
  baseUrl: 'https://my-agent.com/forest',
  apiKey: 'sk-...', // Optional: OpenAI API key for authentication
  timeout: 30000,   // Optional: request timeout in ms (default: 30000)
});
```

### Chat with AI

Send messages to the AI and get completions.

#### Simple usage

```typescript
// Just send a string - it will be wrapped as a user message
const response = await client.chat('What is the weather today?');

console.log(response.choices[0].message.content);
// => "I don't have access to real-time weather data..."
```

#### Advanced usage

```typescript
const response = await client.chat({
  messages: [
    { role: 'system', content: 'You are a helpful assistant.' },
    { role: 'user', content: 'Search for cats' },
  ],
  tools: [
    {
      type: 'function',
      function: {
        name: 'brave_search',
        description: 'Search the web',
        parameters: { type: 'object', properties: { query: { type: 'string' } } },
      },
    },
  ],
  toolChoice: 'auto',
  aiName: 'gpt-4', // Name of the AI configuration on the server
});

// Check if the AI wants to call a tool
if (response.choices[0].message.tool_calls) {
  const toolCall = response.choices[0].message.tool_calls[0];
  console.log(`AI wants to call: ${toolCall.function.name}`);
}
```

### List Available Tools

Get the list of remote tools configured on the server.

```typescript
const tools = await client.getTools();

console.log(tools);
// [
//   {
//     name: 'brave_search',
//     description: 'Search the web using Brave Search',
//     schema: { ... },
//     sourceId: 'brave_search',
//     sourceType: 'server'
//   }
// ]
```

### Call a Tool

Execute a remote tool by name.

```typescript
const result = await client.callTool('brave_search', [
  { role: 'user', content: 'cats' }
]);

console.log(result);
// Search results from Brave Search
```

### Error Handling

All methods throw `AiProxyClientError` on failure.

```typescript
import { AiProxyClientError } from '@forestadmin/ai-proxy/client';

try {
  await client.chat('Hello');
} catch (error) {
  if (error instanceof AiProxyClientError) {
    console.error(`Error ${error.status}: ${error.message}`);
    console.error('Response body:', error.body);
  }
}
```

#### Error status codes

| Status | Description |
|--------|-------------|
| 0 | Network error |
| 401 | Authentication failed |
| 404 | Resource not found |
| 408 | Request timeout |
| 422 | Validation error |

## API Reference

### `createAiProxyClient(config)`

Creates a new AI Proxy client instance.

#### Config options

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `baseUrl` | `string` | Yes | - | Base URL of the AI proxy server |
| `apiKey` | `string` | No | - | API key for authentication (used in `chat()`) |
| `timeout` | `number` | No | 30000 | Request timeout in milliseconds |
| `fetch` | `typeof fetch` | No | `fetch` | Custom fetch implementation |

### `client.chat(input)`

Send a chat message to the AI.

- **input**: `string | ChatInput` - A simple string or an object with:
  - `messages`: Array of chat messages
  - `tools?`: Array of tool definitions
  - `toolChoice?`: Tool choice option (`'auto'`, `'none'`, `'required'`, or specific tool)
  - `aiName?`: Name of the AI configuration to use

- **Returns**: `Promise<ChatCompletion>` - OpenAI-compatible chat completion response

### `client.getTools()`

Get available remote tools.

- **Returns**: `Promise<RemoteToolDefinition[]>`

### `client.callTool(toolName, inputs)`

Call a remote tool.

- **toolName**: `string` - Name of the tool to call
- **inputs**: `ChatCompletionMessage[]` - Input messages for the tool

- **Returns**: `Promise<T>` - Tool execution result

## TypeScript Support

Full TypeScript support with exported types:

```typescript
import type {
  AiProxyClientConfig,
  ChatInput,
  ChatCompletion,
  ChatCompletionMessageParam,
  ChatCompletionTool,
  RemoteToolDefinition,
} from '@forestadmin/ai-proxy/client';

import { AiProxyClientError } from '@forestadmin/ai-proxy/client';
```
