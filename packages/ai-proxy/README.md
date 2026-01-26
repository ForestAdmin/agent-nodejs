# @forestadmin/ai-proxy

AI Proxy client for Forest Admin.

## Quick Start

```typescript
import { createAiProxyClient } from '@forestadmin/ai-proxy/client';

const client = createAiProxyClient({ baseUrl: 'https://my-agent.com/forest' });

const response = await client.chat('Hello!');
console.log(response.choices[0].message.content);
```

## Installation

**Client only** (frontend, no extra dependencies):

```bash
npm install @forestadmin/ai-proxy
```

**Server side** (Router, ProviderDispatcher):

```bash
npm install @forestadmin/ai-proxy @langchain/core @langchain/openai
```

## Configuration

Choose one mode:

```typescript
// Simple mode (recommended)
const client = createAiProxyClient({
  baseUrl: 'https://my-agent.com/forest',
  headers: { Authorization: 'Bearer token' },  // optional
  timeout: 30000,                               // optional (default: 30s)
});

// Custom fetch mode
const client = createAiProxyClient({
  fetch: myCustomFetch,
  timeout: 30000,
});
```

## API

### `chat(input)`

```typescript
// Simple
await client.chat('Hello!');

// With options
await client.chat({
  messages: [{ role: 'user', content: 'Hello!' }],
  tools: [...],         // optional
  toolChoice: 'auto',   // optional
  aiName: 'gpt-4',      // optional - server AI config name
});
```

### `getTools()`

```typescript
const tools = await client.getTools();
// [{ name: 'brave_search', description: '...', schema: {...} }]
```

### `callTool(name, inputs)`

```typescript
const result = await client.callTool('brave_search', [
  { role: 'user', content: 'cats' }
]);
```

## Error Handling

```typescript
import { AiProxyClientError } from '@forestadmin/ai-proxy/client';

try {
  await client.chat('Hello');
} catch (error) {
  if (error instanceof AiProxyClientError) {
    console.error(error.status, error.message);

    if (error.isNetworkError) { /* status 0 */ }
    if (error.isClientError)  { /* status 4xx */ }
    if (error.isServerError)  { /* status 5xx */ }
  }
}
```
