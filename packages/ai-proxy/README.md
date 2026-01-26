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

Two configuration modes are available (mutually exclusive):

#### Simple mode (recommended for frontend)

```typescript
import { createAiProxyClient } from '@forestadmin/ai-proxy/client';

const client = createAiProxyClient({
  baseUrl: 'https://my-agent.com/forest',
  headers: {                              // Optional: custom headers
    Authorization: 'Bearer my-token',
  },
  timeout: 30000,                         // Optional: request timeout in ms (default: 30000)
});
```

#### Custom fetch mode (for agent-client or custom routing)

```typescript
import { createAiProxyClient } from '@forestadmin/ai-proxy/client';

const client = createAiProxyClient({
  fetch: myCustomFetch,  // Your custom fetch implementation
  timeout: 30000,
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

#### With tools

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
        name: 'search',
        description: 'Search the web',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query' },
          },
          required: ['query'],
        },
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
  console.log(`Arguments: ${toolCall.function.arguments}`);
}
```

#### Complex tool with multiple parameters

Tools can have complex schemas with multiple parameters, nested objects, arrays, and enums:

```typescript
const response = await client.chat({
  messages: [
    { role: 'system', content: 'You are a data analyst assistant.' },
    { role: 'user', content: 'Create a sales report for Q4 2024, grouped by region, in PDF format' },
  ],
  tools: [
    {
      type: 'function',
      function: {
        name: 'generate_report',
        description: 'Generate a business report with customizable parameters',
        parameters: {
          type: 'object',
          properties: {
            reportType: {
              type: 'string',
              enum: ['sales', 'inventory', 'customers', 'financial'],
              description: 'Type of report to generate',
            },
            dateRange: {
              type: 'object',
              description: 'Date range for the report',
              properties: {
                start: { type: 'string', format: 'date', description: 'Start date (YYYY-MM-DD)' },
                end: { type: 'string', format: 'date', description: 'End date (YYYY-MM-DD)' },
              },
              required: ['start', 'end'],
            },
            groupBy: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['region', 'product', 'salesperson', 'month'],
              },
              description: 'Fields to group the data by',
            },
            filters: {
              type: 'object',
              description: 'Optional filters to apply',
              properties: {
                regions: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filter by specific regions',
                },
                minAmount: {
                  type: 'number',
                  description: 'Minimum transaction amount',
                },
                status: {
                  type: 'string',
                  enum: ['completed', 'pending', 'cancelled'],
                },
              },
            },
            output: {
              type: 'object',
              properties: {
                format: {
                  type: 'string',
                  enum: ['pdf', 'excel', 'csv', 'json'],
                  description: 'Output file format',
                },
                includeCharts: {
                  type: 'boolean',
                  description: 'Whether to include visual charts',
                },
                language: {
                  type: 'string',
                  enum: ['en', 'fr', 'es', 'de'],
                  default: 'en',
                },
              },
              required: ['format'],
            },
          },
          required: ['reportType', 'dateRange', 'output'],
        },
      },
    },
  ],
  toolChoice: 'auto',
});

// The AI will respond with structured arguments
const toolCall = response.choices[0].message.tool_calls?.[0];
if (toolCall) {
  const args = JSON.parse(toolCall.function.arguments);
  console.log(args);
  // {
  //   reportType: 'sales',
  //   dateRange: { start: '2024-10-01', end: '2024-12-31' },
  //   groupBy: ['region'],
  //   output: { format: 'pdf', includeCharts: true, language: 'en' }
  // }
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

All methods throw `AiProxyClientError` on failure with helpful categorization:

```typescript
import { AiProxyClientError } from '@forestadmin/ai-proxy/client';

try {
  await client.chat('Hello');
} catch (error) {
  if (error instanceof AiProxyClientError) {
    console.error(`Error ${error.status}: ${error.message}`);
    console.error('Response body:', error.body);

    // Error categorization helpers
    if (error.isNetworkError) {
      console.error('Network issue - check your connection');
    } else if (error.isClientError) {
      console.error('Client error (4xx) - check your request');
    } else if (error.isServerError) {
      console.error('Server error (5xx) - try again later');
    }

    // Access the original error if needed
    if (error.cause) {
      console.error('Caused by:', error.cause);
    }
  }
}
```

#### Error status codes

| Status | Description | `isNetworkError` | `isClientError` | `isServerError` |
|--------|-------------|------------------|-----------------|-----------------|
| 0 | Network error | `true` | `false` | `false` |
| 401 | Authentication failed | `false` | `true` | `false` |
| 404 | Resource not found | `false` | `true` | `false` |
| 408 | Request timeout | `false` | `true` | `false` |
| 422 | Validation error | `false` | `true` | `false` |
| 500+ | Server error | `false` | `false` | `true` |

## API Reference

### `createAiProxyClient(config)`

Creates a new AI Proxy client instance.

#### Config options (Simple mode)

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `baseUrl` | `string` | Yes | - | Base URL of the AI proxy server |
| `headers` | `Record<string, string>` | No | - | Custom headers to include in requests |
| `timeout` | `number` | No | 30000 | Request timeout in milliseconds |

#### Config options (Custom fetch mode)

| Option | Type | Required | Default | Description |
|--------|------|----------|---------|-------------|
| `fetch` | `typeof fetch` | Yes | - | Custom fetch implementation |
| `timeout` | `number` | No | 30000 | Request timeout in milliseconds |

### `client.chat(input)`

Send a chat message to the AI.

- **input**: `string | ChatInput` - A simple string or an object with:
  - `messages`: Array of chat messages
  - `tools?`: Array of tool definitions (supports complex schemas)
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

import { AiProxyClient, AiProxyClientError } from '@forestadmin/ai-proxy/client';
```
